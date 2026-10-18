// Grensgeometrie en zoekpunten. Grenslijn NL–DE vereenvoudigd (noord → zuid), nauwkeurig tot ±2 km.
const BORDER = [
  [53.32,7.19],[53.23,7.21],[53.17,7.21],[53.07,7.21],[53.00,7.20],[52.92,7.10],[52.85,7.07],[52.75,7.05],
  [52.68,6.95],[52.65,6.76],[52.60,6.72],[52.55,6.73],[52.48,6.85],[52.43,6.97],[52.38,7.05],[52.30,7.06],
  [52.24,7.04],[52.18,6.99],[52.12,6.88],[52.08,6.76],[52.03,6.70],[51.97,6.82],[51.92,6.80],[51.89,6.70],
  [51.88,6.62],[51.86,6.52],[51.84,6.47],[51.87,6.36],[51.86,6.17],[51.85,6.05],[51.80,5.97],[51.73,5.96],[51.65,6.03],[51.55,6.10],
  [51.45,6.22],[51.37,6.22],[51.30,6.21],[51.25,6.18],[51.18,6.08],[51.10,6.02],[51.05,5.88],[50.99,5.90],
  [50.96,5.99],[50.92,6.02],[50.87,6.08],[50.80,6.03],[50.75,6.02]
];

// Zoekpunten aan Duitse kant; elk punt wordt met straal 12 km bevraagd.
const REGIONS = {
  noord:      {name:"Groningen & Drenthe", pts:[[53.18,7.27],[53.06,7.27],[52.92,7.20],[52.79,7.18],[52.66,7.02],[52.60,6.85]]},
  twente:     {name:"Twente", pts:[[52.47,6.95],[52.42,7.08],[52.30,7.13],[52.20,7.05],[52.10,6.95]]},
  achterhoek: {name:"Achterhoek", pts:[[52.03,6.83],[51.95,6.86],[51.86,6.70],[51.84,6.55],[51.83,6.42]]},
  gelderland: {name:"Arnhem & Nijmegen", pts:[[51.84,6.28],[51.83,6.15],[51.78,6.05],[51.70,6.10],[51.62,6.13]]},
  nlimburg:   {name:"Noord- & Midden-Limburg", pts:[[51.52,6.18],[51.43,6.28],[51.33,6.24],[51.23,6.20],[51.13,6.12]]},
  zlimburg:   {name:"Zuid-Limburg", pts:[[51.04,6.00],[50.97,6.05],[50.90,6.12],[50.82,6.10],[50.76,6.09]]}
};

function haversine(a,b){
  const R=6371,toR=Math.PI/180,dLat=(b[0]-a[0])*toR,dLng=(b[1]-a[1])*toR;
  const h=Math.sin(dLat/2)**2+Math.cos(a[0]*toR)*Math.cos(b[0]*toR)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
// Kortste afstand (km) van punt p tot de grenslijn, via lokale vlakke projectie per segment.
function borderDistance(lat,lng){
  const kx=111.32*Math.cos(lat*Math.PI/180),ky=110.57;
  let best=Infinity;
  for(let i=0;i<BORDER.length-1;i++){
    const ax=(BORDER[i][1]-lng)*kx,ay=(BORDER[i][0]-lat)*ky,bx=(BORDER[i+1][1]-lng)*kx,by=(BORDER[i+1][0]-lat)*ky;
    const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
    let t=len?-(ax*dx+ay*dy)/len:0;t=Math.max(0,Math.min(1,t));
    const x=ax+t*dx,y=ay+t*dy,d=Math.hypot(x,y);
    if(d<best)best=d;
  }
  return best;
}
if(typeof module!=="undefined")module.exports={BORDER,REGIONS,borderDistance,haversine};
