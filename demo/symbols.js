/* One canonical variable namespace for the editor, storage and CAS. */
(function(root){
 'use strict';
 const greek={alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',zeta:'ζ',eta:'η',theta:'θ',iota:'ι',kappa:'κ',lambda:'λ',mu:'μ',nu:'ν',xi:'ξ',rho:'ρ',sigma:'σ',tau:'τ',upsilon:'υ',phi:'φ',chi:'χ',psi:'ψ',omega:'ω',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Xi:'Ξ',Sigma:'Σ',Upsilon:'Υ',Phi:'Φ',Psi:'Ψ',Omega:'Ω'};
 const reserved=new Set(['e','i','C','pi','Pi','ans','NaN','Infinity','constructor','prototype','sin','cos','tan','cot','sec','csc','asin','acos','atan','sinh','cosh','tanh','log','ln','exp','sqrt','abs','floor','ceil','factorial','matrix','vector','solve','diff','integrate','sum','product','factor','expand','simplify','plot','det','invert','transpose']);
 function validName(name){return typeof name==='string'&&/^[A-Za-z][A-Za-z0-9]{0,31}(?:_\d{1,3})?$/.test(name)&&!reserved.has(name);}
 function normaliseName(input){if(typeof input!=='string')return null;let value=input.trim().replace(/^\\(?:mathrm|operatorname)\{([A-Za-z][A-Za-z0-9]*)\}/,'$1').replace(/^\\([A-Za-z]+)/,'$1').replace(/_\{(\d{1,3})\}$/,'_$1');for(const [key,glyph]of Object.entries(greek))if(value.startsWith(glyph))value=key+value.slice(glyph.length);return validName(value)?value:null;}
 function latex(name){const parts=name.split('_'),base=Object.hasOwn(greek,parts[0])?'\\'+parts[0]:parts[0].length===1?parts[0]:'\\mathrm{'+parts[0]+'}';return base+(parts[1]?'_{'+parts[1]+'}':'');}
 root.MathDocsSymbols={validName,normaliseName,latex};if(typeof module==='object')module.exports=root.MathDocsSymbols;
})(globalThis);
