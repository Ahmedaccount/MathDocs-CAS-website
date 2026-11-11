'use strict';
  let ce, symbols;
  const LIMIT = 2048;
  const commands = new Set(['solve','simplify','expand','factor','diff','integrate','det','invert','transpose','N']);
  const functions = Object.freeze({ Sin:'sin',Cos:'cos',Tan:'tan',Cot:'cot',Sec:'sec',Csc:'csc',Arcsin:'asin',Arccos:'acos',Arctan:'atan',Sinh:'sinh',Cosh:'cosh',Tanh:'tanh',Arsinh:'asinh',Arcosh:'acosh',Artanh:'atanh',Abs:'abs',Floor:'floor',Ceil:'ceil',Exp:'exp',Ln:'log',Sqrt:'sqrt',Factorial:'factorial',Sign:'sign' });
  function fail(message) { throw new Error(message); }
  function validName(name) { return symbols.validName(name); }
  function mathSymbol(node) {
    if (typeof node === 'string' && validName(node)) return node;
    if (Array.isArray(node) && node[0] === 'Subscript' && typeof node[1] === 'string' && Number.isInteger(node[2])) {
      const name = node[1] + '_' + node[2]; if (validName(name)) return name;
    }
    fail('Brug ét bogstav som variabel, fx x, a eller a_1. e, i og C er reserverede.');
  }
  function parse(latex) {
    if (!latex || latex.length > LIMIT) fail('Skriv et udtryk på højst 2048 tegn.');
    if (/\\placeholder|#\?|[\u0000-\u0008]/.test(latex)) fail('Udfyld alle felter i formlen.');
    for(const match of latex.matchAll(/\\operatorname\{([A-Za-z]+)\}\s*(?:\\left)?\(/g))if(![...Object.values(functions),'log','ln','lb','lg'].includes(match[1]))fail('Unknown named function. Use supported mathematical functions.');
    const expression = ce.parse(latex.replace(/\\gamma\b/g,'\\mathrm{gamma}'), { canonical: false });
    if (!expression || !expression.isValid) fail('Formlen er ufuldstændig eller indeholder ukendt LaTeX. Kontrollér parenteser og kommandoer.');
    return expression.json;
  }
  function splitArguments(source) {
    const stack = []; const out = []; let start = 0;
    const pair = { ')':'(', ']':'[', '}':'{' };
    for (let i = 0; i < source.length; i++) {
      const c = source[i];
      if ('([{'.includes(c)) stack.push(c);
      else if (')]}'.includes(c)) { if (stack.pop() !== pair[c]) fail('Kontrollér parenteserne i kommandoen.'); }
      else if (c === ',' && stack.length === 0) { out.push(source.slice(start,i)); start = i+1; }
    }
    if (stack.length) fail('Der mangler en afsluttende parentes.');
    out.push(source.slice(start));
    if (out.some(x => !x.trim())) fail('Et argument mangler i kommandoen.');
    return out;
  }
  function extractCommand(latex) {
    const clean = latex.replace(/\\operatorname\{\\mathrm\{(solve|simplify|expand|factor|diff|integrate|det|invert|transpose|N)\}\}/g,'$1').replace(/\\(?:left|right|mleft|mright)/g,'').replace(/\\(?:operatorname|mathrm)\{(solve|simplify|expand|factor|diff|integrate|det|invert|transpose|N)\}/g,'$1').replace(/\\[,!;:]/g,'').trim();
    const match = clean.match(/^([A-Za-z]+)\s*\(([\s\S]*)\)$/);
    if (!match || !commands.has(match[1])) return null;
    return { name: match[1], args: splitArguments(match[2]) };
  }
  function storedValue(name,variables,bound,visiting=new Set(),budget={count:0}) {
    if(++budget.count>600||visiting.size>50)fail('Variablerne afhænger af for mange andre variabler. Del definitionerne op.');
    if(visiting.has(name))fail('Cirkulær definition ved »'+name+'«. Definér variablen med en værdi, der ikke henviser tilbage til sig selv.');
    visiting.add(name);
    let expression;
    try{expression=nerdamer(variables[name]);}catch(error){fail('Variablen »'+name+'« har en ugyldig værdi. Definér den igen med Alt+D.');}
    const substitutions=Object.create(null);
    for(const dependency of expression.variables())if(!bound.has(dependency)&&Object.hasOwn(variables,dependency))substitutions[dependency]=storedValue(dependency,variables,bound,visiting,budget);
    visiting.delete(name);
    const result=Object.keys(substitutions).length?nerdamer(variables[name],substitutions).toString():variables[name];
    if(result.length>6000)fail('Den udvidede variabel »'+name+'« er for stor. Brug en enklere definition.');
    return result;
  }
  function translate(node, variables, bound = new Set(), depth = 0, budget = { count:0 }) {
    if (++budget.count > 600 || depth > 40) fail('Udtrykket er for komplekst. Del beregningen i mindre trin.');
    const t = n => translate(n, variables, bound, depth+1, budget);
    if (typeof node === 'number') { if (!Number.isFinite(node)) fail('Tallet er ikke endeligt.'); return '('+node+')'; }
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      if (typeof node.num === 'string' && /^[+-]?\d+(?:\.\d*)?(?:e[+-]?\d+)?$/i.test(node.num)) return '('+node.num+')';
      if (typeof node.sym === 'string') return t(node.sym);
      fail('Denne taltype understøttes ikke.');
    }
    if (typeof node === 'string') {
      const constants = { Pi:'pi',ExponentialE:'e',ImaginaryUnit:'i',Half:'(1/2)',e:'e',i:'i' };
      if (Object.hasOwn(constants,node)) return constants[node];
      if (node === 'Nothing' || node === 'PositiveInfinity' || node === 'NegativeInfinity') fail('Brug et endeligt matematisk udtryk.');
      if (node !== 'ans' && !validName(node)) fail('Ukendt symbol »'+node+'«. Brug ét bogstav til variabler og de understøttede funktioner.');
      if (!bound.has(node) && Object.hasOwn(variables,node)) return '('+storedValue(node,variables,bound,new Set(),budget)+')';
      if (node === 'ans') fail('Beregn et udtryk først, før du bruger ans.');
      return node;
    }
    if (!Array.isArray(node)) fail('Udtrykket kunne ikke læses.');
    const [op,...args] = node;
    if (Object.hasOwn(functions,op)) {
      if (args.length !== 1) fail('Funktionen kræver ét argument.');
      if (op === 'Factorial' && typeof args[0] === 'number' && args[0] > 500) fail('Fakultet er begrænset til 500.');
      return functions[op]+'('+t(args[0])+')';
    }
    switch(op) {
      case 'Add': return '('+args.map(t).join('+')+')';
      case 'Multiply': case 'InvisibleOperator': return '('+args.map(t).join('*')+')';
      case 'Negate': return '(-'+t(args[0])+')';
      case 'Subtract': return '('+t(args[0])+'-'+t(args[1])+')';
      case 'Divide': case 'Rational': return '('+t(args[0])+'/'+t(args[1])+')';
      case 'Power': if (typeof args[1] === 'number' && Math.abs(args[1]) > 10000) fail('Potensen er for stor.'); return '('+t(args[0])+'^'+t(args[1])+')';
      case 'Square': return '('+t(args[0])+'^2)';
      case 'Root': return '('+t(args[0])+'^(1/'+t(args[1])+'))';
      case 'Log': return 'log('+t(args[0])+','+ (args[1] === undefined ? '10' : t(args[1]))+')';
      case 'Lb': return 'log('+t(args[0])+',2)';
      case 'Lg': return 'log('+t(args[0])+',10)';
      case 'Delimiter': return t(args[0]);
      case 'Subscript': return t(mathSymbol(node));
      case 'List': return '['+args.map(t).join(',')+']';
      case 'Matrix': {
        const rows = args[0];
        if (!Array.isArray(rows) || rows[0] !== 'List' || rows.slice(1).some(row => !Array.isArray(row) || row[0] !== 'List')) fail('Matricen har en ugyldig struktur.');
        const width = rows[1]?.length;
        if (!width || rows.slice(1).some(row => row.length !== width)) fail('Alle matrixrækker skal have samme længde.');
        return 'matrix('+rows.slice(1).map(t).join(',')+')';
      }
      case 'Apply': {
        const inverses = {Sin:'asin',Cos:'acos',Tan:'atan'};
        if (Array.isArray(args[0]) && args[0][0] === 'InverseFunction' && Object.hasOwn(inverses,args[0][1])) return inverses[args[0][1]]+'('+t(args[1])+')';
        fail('Denne funktionsanvendelse understøttes ikke.'); break;
      }
      case 'Integrate': case 'Sum': case 'Product': {
        let spec = args[1]; const tuple = Array.isArray(spec) && ['Tuple','Triple','Pair'].includes(spec[0]);
        const variable = mathSymbol(tuple ? spec[1] : spec);
        const inner = translate(args[0],variables,new Set([...bound,variable]),depth+1,budget);
        if (op === 'Integrate' && !tuple) return 'integrate('+inner+','+variable+')';
        if (!tuple || spec.length !== 4) fail('Angiv både nedre og øvre grænse.');
        const fn = op === 'Integrate' ? 'defint' : op === 'Sum' ? 'sum' : 'product';
        return op === 'Integrate' ? fn+'('+inner+','+t(spec[2])+','+t(spec[3])+','+variable+')' : fn+'('+inner+','+variable+','+t(spec[2])+','+t(spec[3])+')';
      }
      case 'Equal': fail('Brug solve(ligning,x) eller vælg »Løs ligning«.'); break;
      case 'Sequence': fail('Komma er til argumenter; brug punktum i decimaltal.'); break;
      default: fail('Denne notation understøttes ikke af CAS: '+op+'. Brug en af kommandoerne i hjælpen.');
    }
  }
  function plot(request,variables) {
    let source=String(request.latex||'').trim();
    const clean=source.replace(/\\(?:left|right|mleft|mright)/g,'').replace(/\\operatorname\{(?:\\mathrm\{)?plot\}\}?/g,'plot');
    let xminInput=request.xmin,xmaxInput=request.xmax;const wrapped=clean.match(/^plot\s*\(([\s\S]*)\)$/);
    if(wrapped){const args=splitArguments(wrapped[1]);if(args.length!==1&&args.length!==3)fail('Use plot(expression) or plot(expression,xmin,xmax).');source=args[0];if(args.length===3){xminInput=Number(args[1]);xmaxInput=Number(args[2]);}}
    const functionDefinition=clean.match(/^\s*[A-Za-z]\s*\(\s*x\s*\)\s*=([\s\S]+)$/);
    if(functionDefinition)source=functionDefinition[1];
    const tree=parse(source),equation=Array.isArray(tree)&&tree[0]==='Equal';
    const allowed=new Set(['Add','Subtract','Negate','Multiply','InvisibleOperator','Divide','Rational','Power','Square','Root','Sqrt','Sin','Cos','Tan','Cot','Sec','Csc','Arcsin','Arccos','Arctan','Sinh','Cosh','Tanh','Abs','Exp','Ln','Log','Lb','Lg','Delimiter','Subscript','Floor','Ceil']);
    let nodes=0;const denominators=[];
    function validate(node){
      if(++nodes>180)fail('Udtrykket er for komplekst til en graf. Del det op.');
      if(typeof node==='number'||typeof node==='string'||node&&typeof node.num==='string')return;
      if(Array.isArray(node)&&node[0]==='Equal')fail("An '=' appears inside a fraction or subexpression. Use only the equation's main '='. If you meant addition, replace the inner '=' with '+'.");
      if(!Array.isArray(node)||!allowed.has(node[0]))fail('Skriv ét reelt udtryk i x, fx x^2+1. Lister, definitioner og matricer kan ikke tegnes som én y-kurve.');
      if(['Divide','Rational'].includes(node[0]))denominators.push(node[2]);node.slice(1).forEach(validate);
    }
    if(equation){if(tree.length!==3)fail('Use one equation, for example y=x^2 or x^2=y.');validate(tree[1]);validate(tree[2]);}else validate(tree);
    const bound=new Set(equation?['x','y']:['x']);const hasY=node=>node==='y'||Array.isArray(node)&&node.slice(1).some(hasY);let expressions;
    if(!equation)expressions=[nerdamer(translate(tree,variables,bound))];
    else if(tree[1]==='y'&&!hasY(tree[2]))expressions=[nerdamer(translate(tree[2],variables,bound))];
    else if(tree[2]==='y'&&!hasY(tree[1]))expressions=[nerdamer(translate(tree[1],variables,bound))];
    else{
      const relation='('+translate(tree[1],variables,bound)+')-('+translate(tree[2],variables,bound)+')';
      if(!nerdamer(relation).variables().includes('y'))fail('This equation does not define y as a function of x. For example, x=5 is a vertical line. Use an equation containing y.');
      const solutions=nerdamer.solveEquations(relation,'y');
      if(!solutions.length||solutions.length>4)fail('Could not isolate up to four y branches. Rewrite the equation as y=an expression in x.');
      expressions=solutions.map(value=>nerdamer(String(value)));
    }
    const checks=denominators.map(node=>nerdamer(translate(node,variables,bound)));
    const missing=[...new Set(expressions.flatMap(expression=>expression.variables().filter(name=>name!=='x')))];
    if(missing.length)fail('Definér '+missing.join(', ')+' med Alt+D først. Grafen må kun have x som fri variabel.');
    const xmin=xminInput===undefined?-10:Number(xminInput),xmax=xmaxInput===undefined?10:Number(xmaxInput);
    if(!Number.isFinite(xmin)||!Number.isFinite(xmax)||xmin>=xmax||Math.max(Math.abs(xmin),Math.abs(xmax))>1e6)fail('Ret intervallet: x min skal være mindre end x max, og begge skal være endelige tal mellem −1000000 og 1000000.');
    let real=0;const count=expressions.length===1?321:Math.floor((400-(expressions.length-1))/expressions.length),points=[];
    for(const expression of expressions){
      if(points.length)points.push([xmin,null]);
      for(let i=0;i<count;i++){
        const x=xmin+(xmax-xmin)*i/(count-1);let y=null;
        try{
          const value=Number(expression.evaluate({x:String(x)}).text('decimals',14));
          const validDenominators=checks.every(check=>{const n=Number(check.evaluate({x:String(x),y:String(value)}).text('decimals',14));return Number.isFinite(n)&&n!==0;});
          if(validDenominators&&Number.isFinite(value)&&Math.abs(value)<=1e9){y=value;real++;}
        }catch(ignored){}points.push([x,y]);
      }
    }
    if(real<2)fail('Ingen brugbar reel graf i intervallet. Ret definitionsmængden eller vælg andre x-grænser, fx 0 til 10 for sqrt(x).');
    const caption=expressions.length===1?'321 prøvepunkter. Kun reelle værdier vises; huller og asymptoter kan overses. Grafen er ikke et bevis for alle løsninger.':expressions.length+' y branches, '+count+' samples per branch. Only real values are shown. Sampling and symbolic solving may miss branches, gaps or asymptotes.';
    return {answerText:'Graf på ['+xmin+'; '+xmax+']',answerLatex:'\\text{Graf}',variables,operation:'plot',geometry:{kind:'plot',source,xmin,xmax,title:equation?source:'y = '+source,unit:'',equalScale:false,points,caption}};
  }

  function calculate(request) {
    const variables = Object.create(null);
    for (const [name,value] of Object.entries(request.variables || {})) {
      if ((validName(name) || name === 'ans') && typeof value === 'string' && value.length <= 6000 && /^[a-zA-Z0-9_+\-*/^().,\[\]\s]+$/.test(value)) variables[name] = value;
    }
    const latex = String(request.latex || '').trim();
    if (latex.length > LIMIT) fail('Udtrykket må højst være 2048 tegn.');
    if(request.operation==='plot')return plot(request,variables);
    if(request.operation==='geometry'){const model=globalThis.MathDocsGeometry(request.latex);if(!model)fail('Use triangle(a,b,c) or circle(radius).');return {geometry:model,answerText:model.answerText,answerLatex:'',variables};}
    const command = extractCommand(latex);
    let op = command ? command.name : request.operation || 'evaluate';
    if (op === 'N') op = 'numeric';
    if (!['evaluate','numeric','simplify','expand','factor','solve','diff','integrate','det','invert','transpose'].includes(op)) fail('Ukendt beregningstype.');
    let variable = request.variable || 'x';
    if (command) {
      const arity = ['solve','diff','integrate'].includes(op) ? 2 : 1;
      if (command.args.length !== arity) fail(command.name+' kræver '+arity+' argumenter.');
      if (arity === 2) variable = mathSymbol(parse(command.args[1]));
    }
    let tree = parse(command ? command.args[0] : latex);
    let assigned = null;
    if (Array.isArray(tree) && tree[0] === 'Assign') {
      if (command) fail('Gem variabler i et separat trin med :=.');
      assigned = mathSymbol(tree[1]); tree = tree[2]; op = 'evaluate';
      if (!Object.hasOwn(variables,assigned) && Object.keys(variables).length >= 51) fail('Der kan gemmes højst 50 variabler.');
    }
    const equation = Array.isArray(tree) && tree[0] === 'Equal';
    if(equation&&op==='evaluate'&&!assigned){
      op='solve';let isolated=null;try{isolated=mathSymbol(tree[1]);}catch(ignored){}
      if(isolated)variable=isolated;
      else{
        const names=new Set();function collect(node){if(typeof node==='string'&&validName(node))names.add(node);else if(Array.isArray(node)){if(node[0]==='Subscript'){names.add(mathSymbol(node));return;}node.slice(1).forEach(collect);}}collect(tree);
        const free=[...names].filter(name=>!Object.hasOwn(variables,name));
        if(free.length===1)variable=free[0];else if(names.has('x'))variable='x';else if(names.size===1)variable=[...names][0];else if(names.size>1)fail('Choose the variable to solve for, for example solve(a+b=10,a).');
      }
    }
    if (['solve','diff','integrate'].includes(op) && !validName(variable)) fail('Angiv en variabel, fx x.');
    const bound = new Set(['solve','diff','integrate'].includes(op) ? [variable] : []);
    if(assigned&&request.definitionMode==='expression')for(const name of Object.keys(variables))if(name!=='ans')bound.add(name);
    const expression = equation && op === 'solve'
      ? '('+translate(tree[1],variables,bound)+')-('+translate(tree[2],variables,bound)+')'
      : translate(tree,variables,bound);
    let result, answerLatex, answerText, raw, canStore = true;
    let indefinite = op === 'integrate' || (Array.isArray(tree) && tree[0] === 'Integrate' && !Array.isArray(tree[2]));
    if (op === 'solve') {
      const reduced = nerdamer('simplify('+expression+')');
      if (reduced.toString() === '0') {
        answerText = 'Identitet på udtrykkets definitionsmængde'; answerLatex = '\\text{Identitet på definitionsmængden}'; canStore = false;
      } else if (!reduced.variables().length) {
        answerText = 'Ingen løsninger'; answerLatex = '\\varnothing'; canStore = false;
      } else {
        const solutions = nerdamer.solveEquations(expression,variable);
        if (!solutions.length) fail('CAS fandt ingen løsninger. Det kan også betyde, at ligningstypen ikke understøttes; det beviser ikke, at løsninger ikke findes.');
        const values = solutions.map(value => nerdamer(String(value)));
        if(values.length===1){raw=values[0].toString();answerText=variable+' = '+raw;answerLatex=symbols.latex(variable)+'='+values[0].toTeX();}
        else{raw='['+values.map(value=>value.toString()).join(',')+']';answerText=variable+' ∈ {'+values.map(value=>value.toString()).join(', ')+'}';answerLatex=symbols.latex(variable)+'\\in\\left\\{'+values.map(value=>value.toTeX()).join(',\\;')+'\\right\\}';}
      }
    } else {
      if (op === 'diff' || op === 'integrate') result = nerdamer(op+'('+expression+','+variable+')');
      else if(['det','invert','transpose'].includes(op))result=nerdamer((op==='det'?'determinant':op)+'('+expression+')');
      else if (['simplify','expand','factor'].includes(op)) result = nerdamer(op+'('+expression+')');
      else result = nerdamer(expression);
      if (/\b(?:integrate|defint|diff)\(/.test(result.toString())) fail('CAS kunne ikke beregne dette udtryk symbolsk. Prøv en enklere form.');
      raw = result.toString();
      if (op === 'numeric') {
        if (result.variables().length) fail('Gem værdier for alle variabler, før du vælger decimaltal.');
        result = result.evaluate();
        answerText = result.text('decimals',12);
        answerLatex = result.toTeX('decimal');
      } else { answerText = result.toString(); answerLatex = result.toTeX().replace(/vmatrix/g,'pmatrix'); }
      if (indefinite) { answerText += ' + C'; answerLatex += '+C'; canStore = false; }
      if (assigned) {
        if (indefinite) fail('Gem en stamfunktion med integrate(...,x) som et separat trin; integrationskonstanten skal vælges eksplicit.');
        variables[assigned] = raw;
        storedValue(assigned,variables,new Set());
        answerText = assigned+' := '+answerText;
        answerLatex = symbols.latex(assigned)+'\\coloneqq '+answerLatex;
      }
    }
    if ((raw || '').length > 6000 || answerText.length > 6000 || answerLatex.length > 12000) fail('Resultatet er for stort. Del opgaven i mindre trin.');
    if (canStore && raw) variables.ans = raw;
    // Inexact solvers may return only some roots. Do not present a set as exhaustive.
    return { answerText,answerLatex,variables,assigned,operation:op,notice:op === 'solve' ? 'CAS-løsninger; kontrollér definitionsmængde og eventuelle yderligere løsninger.' : '',elapsed:0 };
  }
  try {
    importScripts('symbols.js','geometry.js','vendor/compute-engine/compute-engine.min.js', 'vendor/nerdamer/all.min.js');
    symbols=globalThis.MathDocsSymbols;ce = new ComputeEngine.ComputeEngine();
    self.onmessage = event => {
      const started = performance.now();
      try { const result = calculate(event.data); result.elapsed = performance.now()-started; self.postMessage({ id:event.data.id,result }); }
      catch(error) { self.postMessage({ id:event.data.id,error:String(error.message || 'Beregningen mislykkedes.').slice(0,350) }); }
      finally { nerdamer.clear('all'); }
    };
    self.postMessage({ ready:true });
  } catch(error) { self.postMessage({ fatal:'Matematikmotoren kunne ikke indlæses. Genindlæs udvidelsen under chrome://extensions.' }); }
