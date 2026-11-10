'use strict';
const assert=require('node:assert/strict');
const engine=require('../regex');
const defaults={find:'',replace:'',regex:true,case:true,whole:false,highlight:false};
function search(find,text,options={}) {return [...text.matchAll(engine.makeRegex({...defaults,find,...options}))].map(m=>m[0]);}
assert.deepEqual(search('^([a-z])','Mount Gower\nmay wade'),['m']);
assert.deepEqual(search('feet\\.$','3 feet.\n4 feet.\nnot feet'),['feet.','feet.']);
assert.deepEqual(search('(a)(b)','ab'),['ab']);
assert.equal(engine.replacement({...defaults,find:'(a)(b)',replace:'$2$1'},'ab'),'ba');
assert.deepEqual(search('½','1½ miles'),['½']);
assert.deepEqual(search('a','A\na',{case:false}),['A','a']);
assert.deepEqual(search('cat','cats cat',{whole:true}),['cat']);
assert.deepEqual(search('a+b','a+b aaab',{regex:false}),['a+b']);
assert.throws(()=>engine.makeRegex({...defaults,find:'['}),SyntaxError);
assert.throws(()=>engine.makeRegex({...defaults,find:'a'.repeat(20001)}),/limit/);
let r=engine.makeRegex({...defaults,find:'(?=a)'}),text='aa',hits=0,m;
while((m=r.exec(text))!==null){hits++;if(!m[0].length&&!engine.advanceEmpty(r,text))break;}
assert.equal(hits,2);
console.log('11 regex regression assertions passed');
