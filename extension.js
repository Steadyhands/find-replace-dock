'use strict';
const vscode = require('vscode');
const crypto = require('crypto');
const regexEngine = require('./regex');
const MAX_MATCHES = 50000;
const MAX_LIBRARY_ENTRIES = 1000;
const MAX_IMPORT_BYTES = 1024 * 1024;
const multi = require('./multi');
let lastEditor;
function activate(context) {
  lastEditor = vscode.window.activeTextEditor;
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => { if (e && e.document.uri.scheme !== 'output') lastEditor=e; }));
  const resultsProvider = new ResultsProvider();
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('findReplaceDock.results',resultsProvider,{webviewOptions:{retainContextWhenHidden:true}}));
  const provider = new FindProvider(context,resultsProvider);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('findReplaceDock.panel',provider,{webviewOptions:{retainContextWhenHidden:true}}));
  context.subscriptions.push(vscode.commands.registerCommand('findReplaceDock.focus',()=>vscode.commands.executeCommand('findReplaceDock.panel.focus')));
}
// Search and replacement semantics are shared with multi.js to prevent drift.
const makeRegex = regexEngine.makeRegex;
const escapeRegex = regexEngine.escapeRegex;
function matches(document,state,selection){
  const regex=makeRegex(state); if(!regex)return [];
  const text=document.getText(); const found=[]; let m;
  while((m=regex.exec(text))!==null){
    if(m[0].length===0){if(!regexEngine.advanceEmpty(regex,text))break;continue;}
    const start=document.positionAt(m.index),end=document.positionAt(m.index+m[0].length);
    if(selection && (m.index<document.offsetAt(selection.start)||m.index+m[0].length>document.offsetAt(selection.end)))continue;
    found.push({start:m.index,end:m.index+m[0].length,text:m[0],groups:m,range:new vscode.Range(start,end)});
    if(found.length>=MAX_MATCHES)break;
  }
  return found;
}
/** Retains the historical replacement signature used by editor actions. */
function replacement(pattern,match,repl,caseSensitive){
  const anchored=new RegExp('^(?:'+pattern+')$','u'+(caseSensitive?'':'i'));
  return match.text.replace(anchored,repl);
}
/**
 * Webview provider and extension-host boundary.
 * All file access and editor changes occur here, never in the webview.
 * Webview messages are untrusted even though the HTML is bundled locally.
 */
/**
 * Read-only snapshot of matching lines. Stored positions belong to the original
 * document version; stale results are labelled and are never silently used as
 * precise match locations after a document changes.
 */
class ResultsProvider {
  constructor(){this.items=[];this.query=null;this.source=null;this.view=null;this.provider=null;}
  resolveWebviewView(view){
    this.view=view;
    view.webview.options={enableScripts:true,localResourceRoots:[]};
    view.webview.html=this.html();
    view.webview.onDidReceiveMessage(async message=>{
      if(!message||typeof message!=='object')return;
      if(message.type==='ready'){this.publish();return;}
      if(message.type==='clear'){this.items=[];this.query=null;this.publish();return;}
      if(message.type==='refresh'&&this.source){
        try{
          const data=this.source.editors.map(editor=>({editor,items:matches(editor.document,this.source.state,this.source.selections.get(editor.document.uri.toString())||null)}));
          this.capture(data,this.source.state,this.source.selections);
        }catch(error){vscode.window.showErrorMessage('Find Results: '+error.message);}
        return;
      }
      if(message.type==='navigate'&&Number.isInteger(message.index))await this.navigate(message.index);
    });
  }
  capture(data,state,selections=new Map()){
    this.items=[];
    for(const {editor,items} of data){
      const doc=editor.document,uri=doc.uri.toString();
      // Collect distinct lines; multiple matches on a line yield one entry.
      const byLine=new Map();
      for(const item of items){
        for(let line=item.range.start.line;line<=item.range.end.line;line++){
          if(!byLine.has(line))byLine.set(line,[]);
          byLine.get(line).push(item.range.start.line===line?item.range.start.character:0);
        }
      }
      for(const [line,columns] of byLine){
        this.items.push({uri,version:doc.version,line,columns,filename:vscode.workspace.asRelativePath(doc.uri,false),text:doc.lineAt(line).text});
      }

    }
    this.source={editors:data.map(x=>x.editor),state:{...state},selections};
    this.query=state.find;
    this.publish();
  }
  publish(){
    const rows=this.items.map((item,index)=>{
      const doc=vscode.workspace.textDocuments.find(d=>d.uri.toString()===item.uri);
      return {index,line:item.line+1,uri:item.uri,filename:item.filename,text:item.text,stale:!doc||doc.version!==item.version};
    });
    this.view?.webview.postMessage({type:'results',rows,query:this.query});
  }
  async navigate(index){
    const item=this.items[index];if(!item)return;
    try{
      const doc=await vscode.workspace.openTextDocument(vscode.Uri.parse(item.uri));
      if(doc.version!==item.version){
        vscode.window.showWarningMessage('This result is from an earlier document version. Refresh Find Results for accurate match positions.');
        return;
      }
      const editor=await vscode.window.showTextDocument(doc,{preserveFocus:false,preview:false});
      const start=new vscode.Position(item.line,item.columns[0]||0);
      editor.selection=new vscode.Selection(start,start);
      editor.revealRange(new vscode.Range(start,start),vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }catch(error){vscode.window.showErrorMessage('Cannot navigate to result: '+error.message);}
  }
  html(){
    const nonce=crypto.randomBytes(16).toString('base64');
    return `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'; img-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><style nonce="${nonce}">
      body{margin:0;padding:7px;color:var(--vscode-foreground);background:var(--vscode-panel-background,var(--vscode-editor-background));font:var(--vscode-font-size,13px) var(--vscode-font-family,sans-serif)}
      header{display:flex;gap:8px;align-items:center;position:sticky;top:0;background:inherit;padding-bottom:5px}header span{flex:1;color:var(--vscode-descriptionForeground)}button{color:var(--vscode-button-secondaryForeground);background:var(--vscode-button-secondaryBackground);border:1px solid var(--vscode-panel-border);padding:4px 8px;cursor:pointer}button:focus-visible,.result:focus-visible{outline:2px solid var(--vscode-focusBorder)}
      #list{overflow:auto} .result{display:block;width:max-content;min-width:100%;text-align:left;white-space:pre;font-family:var(--vscode-editor-font-family,monospace);font-size:var(--vscode-editor-font-size,13px);padding:3px 6px;background:transparent;color:var(--vscode-foreground);border:0;cursor:pointer} .result:hover{background:var(--vscode-list-hoverBackground)} .result .loc{color:var(--vscode-descriptionForeground);display:inline-block;min-width:5ch;text-align:right;margin-right:12px;font-variant-numeric:tabular-nums}.file-group{padding:7px 6px 3px;font-weight:600;color:var(--vscode-descriptionForeground);white-space:nowrap}.file-group .count{font-weight:400;margin-left:8px} .result.stale{opacity:.55} .empty{color:var(--vscode-descriptionForeground);padding:10px}.zero-matches{color:#700000!important}
    </style></head><body><header><span id="summary">No results</span><button id="refresh" title="Repeat the captured search">Refresh</button><button id="clear">Clear</button></header><div id="list" role="list" aria-label="Matching lines"></div><script nonce="${nonce}">
      const vscode=acquireVsCodeApi();const list=document.getElementById('list');
      document.getElementById('refresh').onclick=()=>vscode.postMessage({type:'refresh'});
      document.getElementById('clear').onclick=()=>vscode.postMessage({type:'clear'});
      // Render each file name once. For single-file results, put the name in the
      // status line; for multi-file results, use a heading for each file group.
      window.addEventListener('message',event=>{
        const m=event.data;
        if(!m||m.type!=='results'||!Array.isArray(m.rows))return;
        list.replaceChildren();
        const summary=document.getElementById('summary');
        const files=new Map();
        for(const row of m.rows){
          const key=row.uri||row.filename;
          if(!files.has(key))files.set(key,{name:row.filename,rows:[]});
          files.get(key).rows.push(row);
        }
        const single=files.size===1;
        const base=m.rows.length+' matching lines'+(m.query?' · '+m.query:'');
        summary.textContent=single?base+' · '+files.values().next().value.name:base;
        summary.classList.toggle('zero-matches',m.rows.length===0 && !!m.query);
        if(!m.rows.length){
          const empty=document.createElement('div');empty.className='empty';
          empty.textContent='Click List Lines in Find to capture results.';
          list.appendChild(empty);
        }
        for(const group of files.values()){
          if(!single){
            const heading=document.createElement('div');heading.className='file-group';
            const name=document.createElement('span');name.textContent=group.name;
            const count=document.createElement('span');count.className='count';
            count.textContent='('+group.rows.length+' matching lines)';
            heading.append(name,count);list.appendChild(heading);
          }
          for(const row of group.rows){
            const button=document.createElement('button');
            button.className='result'+(row.stale?' stale':'');
            button.title=row.stale?'Document changed since snapshot — refresh before navigating':'Open original document at this line';
            const loc=document.createElement('span');loc.className='loc';loc.textContent=row.line;
            const txt=document.createElement('span');txt.textContent=row.text;
            button.append(loc,txt);
            button.onclick=()=>vscode.postMessage({type:'navigate',index:row.index});
            list.appendChild(button);
          }
        }
      });
      vscode.postMessage({type:'ready'});
    </script></body></html>`;
  }
}
class FindProvider {
  constructor(context,resultsProvider){this.resultsProvider=resultsProvider;this.context=context;this.decorations=vscode.window.createTextEditorDecorationType({backgroundColor:'rgba(255,190,40,.24)',border:'1px solid rgba(255,190,40,.45)'});this.anchor=new Map();this.last=new Map();this.history=context.globalState.get('history',{find:[],replace:[]});this.patterns=context.globalState.get('savedPatterns',[]);}
  resolveWebviewView(view){
    this.view=view;const web=view.webview;web.options={enableScripts:true,localResourceRoots:[]};web.html=this.html(web);
    web.onDidReceiveMessage(async msg=>{
      if(!msg||typeof msg!=='object'||Array.isArray(msg)||typeof msg.type!=='string')return;
      if(msg.type==='focusEditor'){await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');return;}
      if(msg.type==='ready'){this.send({type:'history',history:this.history});this.send({type:'patterns',patterns:this.patterns});return;}
      if(msg.type==='patterns'){if(!['save','manage','import','export'].includes(msg.action))return;try{if(msg.state)regexEngine.validateState(msg.state);await this.managePatterns(msg.action,msg.state,msg.index);}catch(e){this.send({type:'status',text:'Pattern error: '+e.message,error:true});}return;}
      if(msg.type==='chooseFolder'){const picked=await vscode.window.showOpenDialog({canSelectFolders:true,canSelectFiles:false,canSelectMany:false,openLabel:'Use this folder'});if(picked?.length)this.send({type:'folder',uri:picked[0].toString(),label:picked[0].fsPath});return;}
      if(msg.type!=='action'||!['resetSelection','multiFind','multiReplace','count','listLines','replaceAll','replaceOnce','replaceNext','next','previous'].includes(msg.action))return;
      try{regexEngine.validateState(msg.state);await this.run(msg.action,msg.state);}catch(err){this.send({type:'status',text:'Error: '+err.message,error:true});}
    });
  }
  async managePatterns(action,state,index){
    const askName=async value=>vscode.window.showInputBox({title:'Saved Pattern Name',prompt:'Enter a descriptive name',value:value||'',ignoreFocusOut:true,validateInput:v=>v.trim()?'': 'Enter a name'});
    if(action==='save'){
      if(!state.find){this.send({type:'status',text:'Enter a Find expression first.'});return;}
      const name=await askName('');if(name===undefined)return;
      const existing=this.patterns.findIndex(p=>p.name.toLowerCase()===name.trim().toLowerCase());
      if(existing>=0){const answer=await vscode.window.showWarningMessage('Replace existing saved pattern "'+name+'"?',{modal:true},'Replace');if(answer!=='Replace')return;}
      const item={name:name.trim(),find:state.find,replace:state.replace||'',hasReplace:!!state.replace,regex:!!state.regex,case:!!state.case,whole:!!state.whole};
      if(existing>=0)this.patterns[existing]=item;else {if(this.patterns.length>=MAX_LIBRARY_ENTRIES)throw Error('Saved pattern library is full.');this.patterns.push(item);}
    }else if(action==='manage'){
      if(!this.patterns.length){this.send({type:'status',text:'No saved patterns yet.'});return;}
      const picked=await vscode.window.showQuickPick(this.patterns.map((p,i)=>({label:p.name,description:p.hasReplace?'Find + Replace':'Find only',detail:p.find.slice(0,140),index:i})),{placeHolder:'Choose a saved pattern to manage'});if(!picked)return;
      const op=await vscode.window.showQuickPick(['Rename','Edit using current Find/Replace fields','Duplicate','Delete'],{placeHolder:'Action for '+picked.label});if(!op)return;
      const i=picked.index,p=this.patterns[i];
      if(op==='Rename'){const name=await askName(p.name);if(name===undefined)return;this.patterns[i]={...p,name:name.trim()};}
      if(op==='Edit using current Find/Replace fields'){if(!state.find){this.send({type:'status',text:'Enter a Find expression before updating a saved pattern.'});return;}this.patterns[i]={...p,find:state.find,replace:state.replace||'',hasReplace:!!state.replace,regex:!!state.regex,case:!!state.case,whole:!!state.whole};}
      if(op==='Duplicate'){const name=await askName(p.name+' (copy)');if(name===undefined)return;if(this.patterns.length>=MAX_LIBRARY_ENTRIES)throw Error('Saved pattern library is full.');this.patterns.push({...p,name:name.trim()});}
      if(op==='Delete'){const yes=await vscode.window.showWarningMessage('Delete saved pattern "'+p.name+'"?',{modal:true},'Delete');if(yes!=='Delete')return;this.patterns.splice(i,1);}
    }else if(action==='export'){
      const uri=await vscode.window.showSaveDialog({saveLabel:'Export Patterns',filters:{'JSON':['json']},defaultUri:vscode.Uri.file('find-replace-dock-patterns.json')});if(!uri)return;
      await vscode.workspace.fs.writeFile(uri,Buffer.from(JSON.stringify({version:1,patterns:this.patterns},null,2),'utf8'));
      this.send({type:'status',text:'Exported '+this.patterns.length+' saved patterns.'});return;
    }else if(action==='import'){
      const files=await vscode.window.showOpenDialog({canSelectMany:false,filters:{'JSON':['json']},openLabel:'Import Patterns'});if(!files?.length)return;
      const bytes=await vscode.workspace.fs.readFile(files[0]);
      if(bytes.byteLength>MAX_IMPORT_BYTES)throw Error('Pattern library exceeds 1 MB.');
      const raw=JSON.parse(Buffer.from(bytes).toString('utf8'));
      if(!raw||raw.version!==1||!Array.isArray(raw.patterns)||raw.patterns.length>MAX_LIBRARY_ENTRIES)throw Error('Unsupported pattern library format.');
      const incoming=raw.patterns.map(p=>{if(!p||typeof p.name!=='string'||!p.name.trim()||typeof p.find!=='string'||typeof p.replace!=='string'||p.name.length>200||p.find.length>20000||p.replace.length>20000)throw Error('Invalid pattern entry.');if(p.name.trim()!==p.name)throw Error('Pattern names cannot have surrounding whitespace.');
        for(const key of ['hasReplace','regex','case','whole'])if(typeof p[key]!=='boolean')throw Error('Invalid pattern option: '+key);
        return {name:p.name,find:p.find,replace:p.replace,hasReplace:p.hasReplace,regex:p.regex,case:p.case,whole:p.whole};});
      const choice=await vscode.window.showQuickPick(['Merge (same names updated)','Replace entire library'],{placeHolder:'How should imported patterns be handled?'});if(!choice)return;
      if(choice.startsWith('Replace'))this.patterns=incoming;else for(const p of incoming){const i=this.patterns.findIndex(x=>x.name.toLowerCase()===p.name.toLowerCase());if(i<0){if(this.patterns.length>=MAX_LIBRARY_ENTRIES)throw Error('Merged library exceeds 1,000 entries.');this.patterns.push(p);}else this.patterns[i]=p;}
    }
    await this.context.globalState.update('savedPatterns',this.patterns);
    this.send({type:'patterns',patterns:this.patterns});this.send({type:'status',text:'Saved patterns updated ('+this.patterns.length+').'});
  }
  send(msg){this.view?.webview.postMessage(msg);}
  getEditors(scope){
    const all=vscode.window.visibleTextEditors.filter(e=>!e.document.isClosed);
    if(scope==='open'){
      const docs=new Set(),editors=[];
      for(const e of [lastEditor,...all].filter(Boolean)){const k=e.document.uri.toString();if(!docs.has(k)){docs.add(k);editors.push(e);}}
      return editors;
    }
    const editor=lastEditor||vscode.window.activeTextEditor;return editor?[editor]:[];
  }
  getSelection(editor,state){
    if(state.scope!=='selection')return null;
    const key=editor.document.uri.toString();
    if(!this.anchor.has(key)){if(editor.selection.isEmpty)throw Error('Select text in the editor before using Selected text.');this.anchor.set(key,new vscode.Range(editor.selection.start,editor.selection.end));}
    return this.anchor.get(key);
  }
  async run(action,state){
    if(action==='resetSelection'){this.anchor.clear();this.send({type:'status',text:'Selection scope reset.'});return;}
    if(!state.find){this.send({type:'status',text:'Enter text to find.'});return;}
    if(action==='multiFind'||action==='multiReplace'){this.remember('find',state.find);if(action==='multiReplace')this.remember('replace',state.replace);await multi.search(vscode,state,action==='multiReplace',this.send.bind(this));return;}
    const editors=this.getEditors(state.scope);if(!editors.length)throw Error('Open a text editor first.');
    let pattern;try{pattern=state.regex?state.find:escapeRegex(state.find);makeRegex(state);}catch(e){throw Error('Invalid regular expression: '+e.message);}
    const data=editors.map(editor=>({editor,items:matches(editor.document,state,this.getSelection(editor,state))}));
    const total=data.reduce((n,d)=>n+d.items.length,0);
    this.send({type:'count',count:total});
    if(state.highlight){for(const d of data)d.editor.setDecorations(this.decorations,d.items.slice(0,5000).map(m=>m.range));}
    else for(const d of data)d.editor.setDecorations(this.decorations,[]);
    if(action==='listLines'){
      // Snapshot each matching line once, retaining all match offsets on that line.
      // Results remain static until the user explicitly refreshes or clears them.
      const selections=new Map();
      if(state.scope==='selection')for(const d of data)selections.set(d.editor.document.uri.toString(),this.getSelection(d.editor,state));
      this.resultsProvider.capture(data,state,selections);
      this.remember('find',state.find);
      await vscode.commands.executeCommand('workbench.view.extension.findReplaceDockResults');
      if(this.resultsProvider.view){this.resultsProvider.view.show(true);this.resultsProvider.publish();}
      this.send({type:'status',text:`${this.resultsProvider.items.length} matching lines listed.`});
      return;
    }
    if(action==='count'){this.send({type:'status',text:`${total} occurrence${total===1?'':'s'} found.`});return;}
    if(!total){this.send({type:'status',text:'No matches.'});return;}
    this.remember('find',state.find);if(action.startsWith('replace'))this.remember('replace',state.replace);
    if(action==='replaceAll'){
      const edit=new vscode.WorkspaceEdit();let count=0;
      for(const d of data)for(const m of d.items){edit.replace(d.editor.document.uri,m.range,replacement(pattern,m,state.replace,state.case));count++;}
      const ok=await vscode.workspace.applyEdit(edit);if(!ok)throw Error('Replacement could not be applied.');
      this.send({type:'status',text:`${count} items replaced.`});return;
    }
    const flat=data.flatMap(d=>d.items.map(item=>({editor:d.editor,item})));
    const current=lastEditor||editors[0];const currentUri=current.document.uri.toString();
    const key=currentUri+'|'+state.scope+'|'+state.find+'|'+state.regex+'|'+state.case+'|'+state.whole;
    let target;
    if(action==='replaceOnce'||action==='replaceNext'){
      // Use selected match when available, otherwise first match at/after cursor.
      const offset=current.document.offsetAt(current.selection.start);
      target=flat.find(f=>f.editor.document.uri.toString()===currentUri && f.item.start===offset && current.document.offsetAt(current.selection.end)===f.item.end)
        ||flat.find(f=>f.editor.document.uri.toString()===currentUri && f.item.start>=offset)
        ||flat[0];
      const editor=target.editor;const start=target.item.range.start;
      const text=replacement(pattern,target.item,state.replace,state.case);
      const ok=await editor.edit(builder=>builder.replace(target.item.range,text),{undoStopBefore:true,undoStopAfter:true});
      if(!ok)throw Error('Could not edit this document.');
      const position=start.translate(0,0);
      editor.selection=new vscode.Selection(position,position);
      editor.revealRange(new vscode.Range(position,position),vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      await vscode.window.showTextDocument(editor.document,{viewColumn:editor.viewColumn,preserveFocus:true});
      this.last.set(key,{offset:editor.document.offsetAt(position)+text.length});
      this.send({type:'status',text:'1 item replaced. '+(action==='replaceOnce'?'Stayed at replacement.':'Use Next to advance.')});
      if(action==='replaceNext')await this.run('next',state);
      return;
    }
    const currentOffset=current.document.offsetAt(current.selection.active);
    if(action==='next'||action==='previous'){
      const currentIndex=flat.findIndex(f=>f.editor.document.uri.toString()===currentUri && f.item.start===current.document.offsetAt(current.selection.start) && f.item.end===current.document.offsetAt(current.selection.end));
      if(currentIndex>=0)target=flat[(currentIndex+(action==='next'?1:flat.length-1))%flat.length];
      else {
        const idx=flat.findIndex(f=>f.editor.document.uri.toString()===currentUri && f.item.start>=currentOffset);
        target=flat[action==='next'?(idx>=0?idx:0):(idx>0?idx-1:flat.length-1)];
      }
      await vscode.window.showTextDocument(target.editor.document,{viewColumn:target.editor.viewColumn,preserveFocus:false});
      target.editor.selection=new vscode.Selection(target.item.range.start,target.item.range.end);
      target.editor.revealRange(target.item.range,vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      this.send({type:'status',text:`Match ${flat.indexOf(target)+1} of ${total}.`});return;
    }
  }
  remember(kind,value){if(!value)return;this.history[kind]=[value,...this.history[kind].filter(v=>v!==value)].slice(0,30);this.context.globalState.update('history',this.history);this.send({type:'history',history:this.history});}
  html(web){const nonce=crypto.randomBytes(16).toString('base64');return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><style nonce="${nonce}">
  :root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;padding:0 8px 12px;font:var(--vscode-font-size,13px) var(--vscode-font-family,sans-serif);color:var(--vscode-foreground);background:var(--vscode-sideBar-background,var(--vscode-editor-background))}button,textarea,select,input{font:inherit;color:inherit}button{cursor:pointer;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground,var(--vscode-foreground));border:1px solid var(--vscode-panel-border,transparent);border-radius:3px;padding:4px 7px;min-height:26px}button:hover{background:var(--vscode-button-secondaryHoverBackground)}button.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}button.primary:hover{background:var(--vscode-button-hoverBackground)}button:focus-visible,textarea:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:1px}.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:0 -8px 7px;border-bottom:1px solid var(--vscode-panel-border)}.tabs button{border:0;border-bottom:2px solid transparent;background:transparent;padding:6px 2px;font-size:11px;line-height:1.2;min-width:0;overflow-wrap:anywhere}.tabs button.active{color:var(--vscode-foreground);border-bottom-color:var(--vscode-focusBorder);font-weight:600}.tabs button[aria-selected=true]{background:var(--vscode-list-activeSelectionBackground);color:var(--vscode-list-activeSelectionForeground)}label.title{display:block;margin:7px 0 3px;font-weight:600}textarea{font-size:var(--afr-input-font-size,14px);line-height:1.45;font-family:var(--vscode-editor-font-family,monospace);width:100%;min-height:62px;resize:vertical;padding:5px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,var(--vscode-panel-border))}textarea:focus{border-color:var(--vscode-focusBorder)}.tools{display:flex;justify-content:flex-end;gap:4px;margin:2px 0}.tools button{padding:2px 6px;min-height:23px}.history-select{width:100%;margin:2px 0 5px}.scope{border:1px solid var(--vscode-panel-border);padding:5px 7px;margin:7px 0}.scope legend{padding:0 4px}.scope label,.options label{display:block;margin:4px 0}.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin:7px 0}.options{border-top:1px solid var(--vscode-panel-border);padding-top:5px}.status{margin:6px 0;min-height:18px;color:var(--vscode-descriptionForeground);overflow-wrap:anywhere}.status.zero-matches{color:#700000}.hidden{display:none!important}.hint{font-size:11px;color:var(--vscode-descriptionForeground)}select{width:100%;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground,var(--vscode-foreground));border:1px solid var(--vscode-dropdown-border);padding:3px}input{accent-color:var(--vscode-focusBorder)}.font-control{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:4px 0 6px}.font-control label{flex:1}.spinner{display:flex;align-items:center;gap:3px}.spinner button{width:26px;padding:2px}.spinner input{width:45px;text-align:center;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,var(--vscode-panel-border));padding:3px;appearance:textfield;-moz-appearance:textfield}.spinner input::-webkit-inner-spin-button,.spinner input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.folder-row{display:flex;gap:5px;margin-top:5px}.folder-row input{min-width:0;flex:1;background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);padding:4px}.folder-row button{flex-shrink:0}.pattern-actions{display:flex;flex-wrap:wrap;gap:4px;margin:3px 0 6px}.pattern-actions button{flex:1 1 auto;white-space:nowrap}.field-heading{display:flex;align-items:center;justify-content:space-between;gap:5px;margin:5px 0 3px}.field-heading .title{margin:0}.field-heading button{min-height:22px;padding:1px 6px} @media(max-width:260px){.tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.font-control{flex-wrap:wrap}}
  </style></head><body><div class="tabs" role="tablist" aria-label="Search mode"><button role="tab" aria-selected="true" id="findTab" class="active">Find</button><button role="tab" aria-selected="false" id="replaceTab">Replace</button><button role="tab" aria-selected="false" id="multiFindTab">Find in Files</button><button role="tab" aria-selected="false" id="multiReplaceTab">Replace in Files</button></div>
  <div class="font-control"><label for="inputFontSize">Find/Replace font size:</label><div class="spinner"><button type="button" id="fontMinus" aria-label="Decrease font size">−</button><input id="inputFontSize" type="number" min="10" max="40" step="1" aria-label="Find and Replace font size in pixels"><button type="button" id="fontPlus" aria-label="Increase font size">+</button><span>px</span></div></div>
  <label class="title" for="patternSelect">Saved Patterns:</label><select id="patternSelect" aria-label="Saved patterns"><option value="">Choose a saved pattern…</option></select><div class="pattern-actions"><button id="patternSave" title="Save the current Find and optional Replace expression">Save Current</button><button id="patternManage">Manage…</button><button id="patternImport">Import…</button><button id="patternExport">Export…</button></div>
  <div class="field-heading"><label class="title" for="find">Find what:</label><button id="findHistory" title="Search history">History ▾</button></div><textarea id="find" spellcheck="false" placeholder="Search text or regular expression"></textarea><select id="findHistoryList" class="history-select hidden" aria-label="Previous searches"><option value="">Choose previous search…</option></select>
  <section id="replaceSection" class="hidden"><div class="field-heading"><label class="title" for="replace">Replace with:</label><button id="replaceHistory" title="Replacement history">History ▾</button></div><textarea id="replace" spellcheck="false" placeholder="Replacement text"></textarea><select id="replaceHistoryList" class="history-select hidden" aria-label="Previous replacements"><option value="">Choose previous replacement…</option></select></section>
  <fieldset id="singleScope" class="scope"><legend>In:</legend><label><input type="radio" name="scope" value="current" checked> Current file</label><label><input type="radio" name="scope" value="selection"> Selected text</label><label><input type="radio" name="scope" value="open"> All open files (visible editors)</label></fieldset>
  <fieldset id="multiScope" class="scope hidden"><legend>Search in:</legend><label><input type="radio" name="multiScope" value="open" checked> All open files</label><label><input type="radio" name="multiScope" value="workspace"> Current workspace</label><label><input type="radio" name="multiScope" value="folder"> Selected folder</label><div id="folderRow" class="folder-row hidden"><input id="folderPath" readonly placeholder="Choose a folder…"><button id="browseFolder">Browse…</button></div><label class="title" for="fileFilter">Files to include:</label><input id="fileFilter" value="**/*" placeholder="**/*.md" style="box-sizing:border-box;width:100%;background:var(--vscode-input-background);color:var(--vscode-foreground);padding:5px;border:1px solid var(--vscode-input-border)"></fieldset>
  <div id="multiFindActions" class="actions hidden"><button data-action="multiFind" class="primary">Find All in Files</button></div><div id="multiReplaceActions" class="actions hidden"><button data-action="multiReplace" class="primary">Preview Replacements</button></div>
  <div id="findActions" class="actions"><button data-action="next" >Next</button><button data-action="previous">Previous</button><button data-action="count">Count All</button><button data-action="listLines">List Lines</button></div>
  <div id="replaceActions" class="actions hidden"><button data-action="next">Next</button><button data-action="replaceNext">Replace & Next</button><button data-action="replaceOnce" >Replace Once</button><button data-action="replaceAll">Replace All</button></div>
  <div class="status" id="status" role="status">Ready.</div><div class="options"><label><input type="checkbox" id="whole"> Match whole word</label><label><input type="checkbox" id="case"> Match case</label><label><input type="checkbox" id="highlight"> Highlight all matches</label><label><input type="checkbox" id="regex" title="Uses JavaScript regular-expression syntax"> Regular expressions</label></div><p class="hint">Selected text: select a range in the editor first. Switch to Current file and back to reset the selection.</p>
  <script nonce="${nonce}">
  const vscode=acquireVsCodeApi();const $=id=>document.getElementById(id);let history={find:[],replace:[]};let patterns=[];let tab='find';const saved=vscode.getState();function setFontSize(value){const n=Math.max(10,Math.min(40,Math.round(Number(value)||14)));$('inputFontSize').value=String(n);document.documentElement.style.setProperty('--afr-input-font-size',n+'px');if(initialised)save();}let initialised=false;setFontSize(saved&&saved.inputFontSize||14);$('inputFontSize').addEventListener('change',()=>setFontSize($('inputFontSize').value));$('fontMinus').onclick=()=>setFontSize(Number($('inputFontSize').value)-1);$('fontPlus').onclick=()=>setFontSize(Number($('inputFontSize').value)+1);if(saved){$('find').value=saved.find||'';$('replace').value=saved.replace||'';for(const k of ['whole','case','highlight','regex'])$(k).checked=!!saved[k];if(saved.scope){const radio=[...document.querySelectorAll('input[name=scope]')].find(x=>x.value===saved.scope);if(radio)radio.checked=true;}if(saved.multiScope){const radio=document.querySelector('input[name=multiScope][value="'+saved.multiScope+'"]');if(radio)radio.checked=true;}if(saved.folderUri){$('folderPath').dataset.uri=saved.folderUri;$('folderPath').value=saved.folderLabel||saved.folderUri;}if(saved.fileFilter)$('fileFilter').value=saved.fileFilter;}initialised=true;
  function state(){return {inputFontSize:Number($('inputFontSize').value),find:$('find').value,replace:$('replace').value,whole:$('whole').checked,case:$('case').checked,highlight:$('highlight').checked,regex:$('regex').checked,scope:document.querySelector('input[name=scope]:checked').value,multiScope:document.querySelector('input[name=multiScope]:checked').value,folderUri:$('folderPath').dataset.uri||'',folderLabel:$('folderPath').value,fileFilter:$('fileFilter').value};}
  function save(){if(initialised)vscode.setState(state());}
  function action(a){save();vscode.postMessage({type:'action',action:a,state:state()});}
  for(const el of document.querySelectorAll('textarea,input'))el.addEventListener('input',save);
  for(const el of document.querySelectorAll('input[name=scope]'))el.addEventListener('change',()=>{action('resetSelection');save();});
  for(const el of document.querySelectorAll('[data-action]'))el.addEventListener('click',()=>action(el.dataset.action));
  function switchTab(next){tab=next;for(const name of ['find','replace','multiFind','multiReplace']){$(name+'Tab').classList.toggle('active',name===next);$(name+'Tab').setAttribute('aria-selected',String(name===next));}const isMulti=next.startsWith('multi');$('replaceSection').classList.toggle('hidden',next!=='replace'&&next!=='multiReplace');$('singleScope').classList.toggle('hidden',isMulti);$('multiScope').classList.toggle('hidden',!isMulti);for(const name of ['find','replace','multiFind','multiReplace'])$(name+'Actions').classList.toggle('hidden',name!==next);}
  for(const name of ['find','replace','multiFind','multiReplace'])$(name+'Tab').onclick=()=>switchTab(name);
  document.querySelector('.tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const names=['find','replace','multiFind','multiReplace'];let i=names.indexOf(tab);i=event.key==='Home'?0:event.key==='End'?3:(i+(event.key==='ArrowRight'?1:3))%4;switchTab(names[i]);$(names[i]+'Tab').focus();event.preventDefault();});
  for(const field of ['find','replace'])$(field).addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.ctrlKey&&!event.altKey&&!event.metaKey){event.preventDefault();action(event.shiftKey?'previous':'next');}else if(event.key==='Escape'){event.preventDefault();vscode.postMessage({type:'focusEditor'});}});
  function updateFolder(){const isFolder=document.querySelector('input[name=multiScope]:checked').value==='folder';$('folderRow').classList.toggle('hidden',!isFolder);save();}
  for(const el of document.querySelectorAll('input[name=multiScope]'))el.addEventListener('change',updateFolder);
  $('browseFolder').onclick=()=>vscode.postMessage({type:'chooseFolder'});
  $('fileFilter').addEventListener('input',save);
  function renderHistory(){for(const kind of ['find','replace']){const list=$(kind+'HistoryList');list.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose previous '+(kind==='find'?'search':'replacement')+'…';list.appendChild(placeholder);for(const [i,value] of history[kind].entries()){const option=document.createElement('option');option.value=String(i);option.textContent=value.replace(/\\n/g,' ↵ ').slice(0,150);option.title=value;list.appendChild(option);}list.value='';}}
  for(const kind of ['find','replace']){$(kind+'History').onclick=()=>{const list=$(kind+'HistoryList');if(!history[kind].length){$('status').textContent='No '+kind+' history yet. Use Find Next or Replace to record an entry.';return;}renderHistory();list.classList.toggle('hidden');if(!list.classList.contains('hidden'))list.focus();};$(kind+'HistoryList').onchange=()=>{const list=$(kind+'HistoryList');if(list.value!==''){$(kind).value=history[kind][Number(list.value)];save();list.classList.add('hidden');$(kind).focus();}};}
  function renderPatterns(){const sel=$('patternSelect');sel.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose a saved pattern…';sel.appendChild(placeholder);for(const [i,p] of patterns.entries()){const opt=document.createElement('option');opt.value=String(i);opt.textContent=p.name+(p.hasReplace?' (Find + Replace)':' (Find)');sel.appendChild(opt);}sel.value='';}
  $('patternSelect').onchange=()=>{const i=$('patternSelect').value;if(i==='')return;const p=patterns[Number(i)];if(!p)return;$('find').value=p.find;$('replace').value=p.hasReplace?p.replace:'';$('regex').checked=p.regex;$('case').checked=p.case;$('whole').checked=p.whole;save();$('status').textContent='Loaded pattern: '+p.name+'. Search options restored (including Regular expressions). No search or replacement has been run.';};
  for(const [id,op] of [['patternSave','save'],['patternManage','manage'],['patternImport','import'],['patternExport','export']])$(id).onclick=()=>vscode.postMessage({type:'patterns',action:op,state:state()});
  window.addEventListener('message',event=>{const m=event.data;if(m.type==='history'){history=m.history;renderHistory();}if(m.type==='patterns'){patterns=m.patterns;renderPatterns();}if(m.type==='folder'){$('folderPath').value=m.label;$('folderPath').dataset.uri=m.uri;save();}if(m.type==='status'){$('status').textContent=m.text;$('status').classList.toggle('zero-matches',/^No matches\.?$/i.test(m.text));$('status').style.color=m.error?'var(--vscode-errorForeground)':'';}if(m.type==='count'){$('status').textContent=m.count+' occurrences found.';$('status').classList.toggle('zero-matches',m.count===0);$('status').style.color='';}});
  updateFolder();vscode.postMessage({type:'ready'});
  </script></body></html>`;}
}
function deactivate(){}
module.exports={activate,deactivate};
