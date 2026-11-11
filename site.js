/* Public demo: local bundled math libraries, no account, storage or document access. */
(() => {
'use strict';
const $=id=>document.getElementById(id),da=document.documentElement.lang==='da';
if(!$('demo-start'))return;
const words=da?{loading:'Indlæser editor …',ready:'Klar. Enter beregner.',working:'Beregner …',plot:'Tegner graf …',failed:'Demoen kunne ikke indlæses. Prøv igen.',timeout:'Beregningen tog for lang tid. Prøv et enklere udtryk.',cancelled:'Beregning afbrudt. Dit udtryk er bevaret.',copy:'Svar kopieret.',copyFail:'Kopiering er ikke tilgængelig. Du kan markere svaret.',empty:'Skriv et udtryk først.',range:'Grafen viser prøvepunkter. Kontrollér definitionsmængden.'}:{loading:'Loading the editor …',ready:'Ready. Enter solves.',working:'Solving …',plot:'Plotting …',failed:'The demo could not load. Please try again.',timeout:'That calculation took too long. Try a simpler expression.',cancelled:'Calculation cancelled. Your expression is preserved.',copy:'Result copied.',copyFail:'Copy is unavailable. You can select the result.',empty:'Type an expression first.',range:'Sampled preview. Check the function’s domain.'};
const samples={fraction:String.raw`\frac{1}{2}+\frac{1}{3}`,equation:'2x+5=11',plot:'y=x^2-4',matrix:String.raw`\begin{pmatrix}1&2\\3&4\end{pmatrix}`};
let mf,worker,workerReady,startPromise,pending,timer,serial=0,busy=false,answer='',variables={},activeSample='fraction';
function status(message,error=false){$('demo-status').textContent=message;$('demo-status').classList.toggle('error',error);}
function setBusy(value){busy=value;if(mf)mf.readOnly=value;for(const e of document.querySelectorAll('[data-sample],#demo-solve,#demo-plot,#demo-copy'))e.disabled=value;$('demo-cancel').hidden=!value;}
function resetResult(){$('demo-result').hidden=true;$('demo-graph').replaceChildren();answer='';}
function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error(words.failed));};document.head.append(s);});}
function engine(){
 if(workerReady)return workerReady;
 workerReady=new Promise((resolve,reject)=>{
  const w=worker=new Worker('demo/cas-worker.js');let warm=setTimeout(()=>{if(worker===w){w.terminate();worker=null;workerReady=null;reject(Error(words.failed));}},12000);
  w.onerror=()=>{clearTimeout(warm);if(pending)finish(null,words.failed);else reject(Error(words.failed));if(worker===w){worker=null;workerReady=null;w.terminate();}};
  w.onmessage=e=>{if(worker!==w)return;const d=e.data;if(d.ready){clearTimeout(warm);resolve();return;}if(d.fatal){clearTimeout(warm);reject(Error(d.fatal));w.terminate();worker=null;workerReady=null;return;}if(pending&&d.id===pending){finish(d.result,d.error);}};
 });workerReady.catch(()=>{});return workerReady;
}
function makeGraph(g){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 560 310');svg.setAttribute('role','img');svg.setAttribute('aria-label',da?'Graf af dit udtryk':'Graph of your expression');
 const valid=g.points.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));if(valid.length<2)return svg;
 const xmin=g.xmin??Math.min(...valid.map(p=>p[0])),xmax=g.xmax??Math.max(...valid.map(p=>p[0]));let ymin=Math.min(0,...valid.map(p=>p[1])),ymax=Math.max(0,...valid.map(p=>p[1]));const pad=Math.max(1,ymax-ymin)*.1;ymin-=pad;ymax+=pad;
 const x=v=>48+(v-xmin)/(xmax-xmin||1)*474,y=v=>260-(v-ymin)/(ymax-ymin)*230;
 const add=(name,attrs,text)=>{const e=document.createElementNS(svg.namespaceURI,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;svg.append(e);return e;};
 for(let i=0;i<=4;i++){const xx=xmin+(xmax-xmin)*i/4,yy=ymin+(ymax-ymin)*i/4;add('line',{x1:x(xx),x2:x(xx),y1:30,y2:260,stroke:'#e3eadb'});add('line',{x1:48,x2:522,y1:y(yy),y2:y(yy),stroke:'#e3eadb'});add('text',{x:x(xx),y:282,'text-anchor':'middle',fill:'#617456','font-size':10},Number(xx.toPrecision(3)));add('text',{x:40,y:y(yy)+4,'text-anchor':'end',fill:'#617456','font-size':10},Number(yy.toPrecision(3)));}
 add('line',{x1:48,x2:522,y1:y(0),y2:y(0),stroke:'#9eae92'});if(xmin<=0&&xmax>=0)add('line',{x1:x(0),x2:x(0),y1:30,y2:260,stroke:'#9eae92'});
 let d='',last=null;for(const p of g.points){if(!Number.isFinite(p[1])){last=null;continue;}const jump=last&&Math.abs(p[1]-last[1])>(ymax-ymin)*.8;d+=(!last||jump?'M':'L')+x(p[0]).toFixed(2)+','+y(p[1]).toFixed(2);last=p;}
 add('path',{d,fill:'none',stroke:'#235b45','stroke-width':2.5});add('text',{x:535,y:265,fill:'#617456','font-size':12},'x');add('text',{x:46,y:18,fill:'#617456','font-size':12},'y');return svg;
}
function finish(result,error){clearTimeout(timer);pending=null;setBusy(false);if(error){status(window.EnglishUI?EnglishUI(error):error,true);return;}if(!result)return;if(result.variables)variables=result.variables;answer=EnglishUI(result.answerText);$('demo-result-math').setAttribute('aria-label',answer);$('demo-result-math').innerHTML=MathLive.convertLatexToMarkup(EnglishUI(result.answerLatex));$('demo-graph').replaceChildren();if(result.geometry)$('demo-graph').append(makeGraph(result.geometry));$('demo-result').hidden=false;status(result.geometry?words.range:words.ready);}
async function calculate(operation='evaluate'){
 if(busy||!mf)return;const latex=mf.getValue('latex-unstyled').trim();if(!latex){status(words.empty,true);mf.focus();return;}
 const run=++serial;setBusy(true);resetResult();status(operation==='plot'?words.plot:words.working);
 try{await engine();if(!busy||run!==serial)return;const id=run;pending=id;timer=setTimeout(()=>{worker?.terminate();worker=null;workerReady=null;finish(null,words.timeout);},8000);worker.postMessage({id,latex,operation,variable:'x',variables,xmin:-5,xmax:5});}catch(error){if(run===serial){setBusy(false);status(words.failed,true);}}
}
async function start(sample=activeSample){
 activeSample=sample;
 if(!startPromise){$('demo-start').disabled=true;$('demo-start').textContent=words.loading;
 startPromise=(async()=>{for(const href of ['demo/vendor/mathlive/mathlive-fonts.css','demo/vendor/mathlive/mathlive-static.css']){const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.append(l);}if(!window.MathfieldElement)await script('demo/vendor/mathlive/mathlive.min.js');MathfieldElement.fontsDirectory=new URL('demo/vendor/mathlive/fonts',location.href).href;MathfieldElement.soundsDirectory=null;if(!window.EnglishUI)await script('demo/english.js');if(!mf){mf=new MathfieldElement();mf.id='demo-formula';mf.setAttribute('aria-labelledby','demo-input-label');mf.mathVirtualKeyboardPolicy='manual';mf.letterShapeStyle='iso';$('demo-field-mount').append(mf);mf.addEventListener('input',()=>{resetResult();status(words.ready);});mf.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();calculate();}});}await engine();$('demo-shell').hidden=false;$('demo-start').hidden=true;status(words.ready);})().catch(error=>{startPromise=null;worker?.terminate();worker=null;workerReady=null;$('demo-start').disabled=false;$('demo-start').textContent=words.failed;throw error;});}
 try{await startPromise;if(busy)return;mf.setValue(samples[activeSample],{silenceNotifications:true});resetResult();for(const b of document.querySelectorAll('[data-sample]'))b.setAttribute('aria-pressed',String(b.dataset.sample===activeSample));mf.focus();}catch(error){/* The start button provides retry without losing the rest of the page. */}
}
$('demo-start').onclick=()=>start();
for(const e of document.querySelectorAll('[data-example],[data-sample]'))e.addEventListener('click',()=>{if(!busy)start(e.dataset.example||e.dataset.sample);});
$('demo-solve').onclick=()=>calculate();$('demo-plot').onclick=()=>calculate('plot');
$('demo-cancel').onclick=()=>{serial++;worker?.terminate();worker=null;workerReady=null;finish(null,words.cancelled);};
window.addEventListener('pagehide',()=>{clearTimeout(timer);worker?.terminate();});
$('demo-copy').onclick=async()=>{try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(answer);status(words.copy);}catch{status(words.copyFail,true);}};
})();
