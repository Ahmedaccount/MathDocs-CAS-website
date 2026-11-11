/* Local triangle and circle models. No Google services or network calls. */
(function(root){
function mathdocsGeometry_(source) {
  const match=String(source).trim().match(/^(trekant|triangle|cirkel|circle|plot)\s*\(([\s\S]*)\)$/i);
  if(!match)return null;
  const name=match[1].toLowerCase(), args=mathdocsSplitArgs_(match[2]);
  const number=value=>{
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))throw new Error('Geometri kræver tal med decimalpunktum, fx 3.5. Komma adskiller argumenter.');
    const result=Number(value);if(!Number.isFinite(result)||result<=0||result>1e6)throw new Error('Længder skal være større end 0 og højst 1000000.');return result;
  };
  const unit=value=>{value=value||'enheder';if(!['cm','mm','m','enheder'].includes(value))throw new Error('Brug enheden cm, mm eller m.');return value;};
  const f=mathdocsFormatNumber_;
  if(name==='trekant'||name==='triangle') {
    if(args.length!==3&&args.length!==4)throw new Error('Brug trekant(a,b,c,cm), fx trekant(3,4,5,cm).');
    const [a,b,c]=args.slice(0,3).map(number), u=unit(args[3]);
    const sides=[a,b,c].sort((x,y)=>y-x),[largest,middle,smallest]=sides;
    if(middle+smallest-largest<=largest*1e-12)throw new Error('Siderne danner ikke en entydig trekant. Summen af de to korte sider skal være større end den længste.');
    // Kahan's rearrangement of Heron's formula avoids cancellation in skinny triangles.
    const area=Math.sqrt((largest+(middle+smallest))*(smallest-(largest-middle))*(smallest+(largest-middle))*(largest+(middle-smallest)))/4;
    const angle=(opposite,side1,side2)=>Math.acos(Math.max(-1,Math.min(1,(side1*side1+side2*side2-opposite*opposite)/(2*side1*side2))))*180/Math.PI;
    const A=angle(a,b,c),B=angle(b,a,c),C=180-A-B;
    const x=(b*b+c*c-a*a)/(2*c), y=2*area/c;
    const vertices=[[0,0],[c,0],[x,y]];
    return {kind:'triangle',source,title:'Trekant ABC',unit:u,vertices,points:[...vertices,vertices[0]],equalScale:true,
      measures:{area,perimeter:a+b+c,angles:[A,B,C],sides:[a,b,c]},
      answerText:'Areal = '+f(area)+' '+u+'²; omkreds = '+f(a+b+c)+' '+u+'; A = '+f(A)+'°, B = '+f(B)+'°, C = '+f(C)+'°.',
      caption:'AB = c = '+f(c)+' '+u+', AC = b = '+f(b)+' '+u+', BC = a = '+f(a)+' '+u+'. A(0; 0), B('+f(c)+'; 0), C('+f(x)+'; '+f(y)+'). Akserne har samme målestok.'};
  }
  if(name==='cirkel'||name==='circle') {
    if(args.length!==1&&args.length!==2)throw new Error('Brug cirkel(radius,cm), fx cirkel(3,cm).');
    const r=number(args[0]),u=unit(args[1]);
    const points=Array.from({length:129},(_,i)=>i===128?[r,0]:[r*Math.cos(i*2*Math.PI/128),r*Math.sin(i*2*Math.PI/128)]);
    return {kind:'circle',source,title:'Cirkel med radius '+f(r)+' '+u,unit:u,points,equalScale:true,
      measures:{radius:r,area:Math.PI*r*r,circumference:2*Math.PI*r},
      answerText:'Areal = '+f(r*r)+'π '+u+'² ≈ '+f(Math.PI*r*r)+' '+u+'²; omkreds = '+f(2*r)+'π '+u+' ≈ '+f(2*Math.PI*r)+' '+u+'.',
      caption:'Centrum O(0; 0), radius '+f(r)+' '+u+'. Figuren er en statisk skitse med samme målestok på begge akser.'};
  }
  throw new Error('Use Alt+P to plot a function.');
}
function mathdocsSplitArgs_(source) {
  const pairs={')':'(',']':'[','}':'{'},stack=[],args=[];let start=0;
  for(let i=0;i<source.length;i++){
    const c=source[i];if('([{'.includes(c))stack.push(c);
    else if(')]}'.includes(c)){if(stack.pop()!==pairs[c])throw new Error('Kontrollér parenteserne.');}
    else if(c===','&&!stack.length){args.push(source.slice(start,i).trim());start=i+1;}
  }
  if(stack.length)throw new Error('Der mangler en afsluttende parentes.');
  args.push(source.slice(start).trim());if(args.some(arg=>!arg))throw new Error('Der mangler et argument.');return args;
}
function mathdocsFormatNumber_(value) {
  if(!Number.isFinite(value))throw new Error('Beregningen gav ikke et endeligt tal.');
  return Number(value.toPrecision(9)).toString().replace('.',',');
}
root.MathDocsGeometry=mathdocsGeometry_;
})(globalThis);
