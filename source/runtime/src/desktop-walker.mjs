/** Host placement helper: Rive owns the character animation; this positions its host element.
 * turnDelayMs optionally holds host translation after a change of facing. The
 * requested Rive gait starts after the delay, so the character can face the
 * direction before walking. This does not guarantee a finished turn or foot
 * contact. reverseTurnDelayMs can allow more time when changing profile direction.
 * Delays default to zero, and interruptions remain active.
 * Optional gaitMetrics entries provide canvas, artboardWidth, artboardHeight,
 * distancePerCycle, and cycleSeconds. They assume Fit.Contain and derive host
 * speed from the current canvas size. Other gaits use the fixed speed fallback.
 */
export function createDesktopWalker({character,container,element,speed=100,initialX=0,turnDelayMs=0,reverseTurnDelayMs=turnDelayMs,gaitMetrics={}}){
 if(!character||typeof character.presentationState!=='function'||!container||!element)throw new TypeError('Character, container, and positioned element are required');
 if(!Number.isFinite(speed)||speed<=0||!Number.isFinite(initialX)||!Number.isFinite(turnDelayMs)||turnDelayMs<0||!Number.isFinite(reverseTurnDelayMs)||reverseTurnDelayMs<0)throw new TypeError('Invalid travel speed or position');
 if(!gaitMetrics||typeof gaitMetrics!=='object'||Array.isArray(gaitMetrics))throw new TypeError('Invalid gait metrics');
 for(const [gait,m] of Object.entries(gaitMetrics)){if(!['walk','run'].includes(gait)||!m||typeof m.canvas?.getBoundingClientRect!=='function'||![m.artboardWidth,m.artboardHeight,m.distancePerCycle,m.cycleSeconds].every(n=>Number.isFinite(n)&&n>0))throw new TypeError('Invalid gait metrics');}
 // Fit.Contain uses the smaller of the canvas-to-artboard scales.
 // distancePerCycle is the path distance over one animation cycle, in artboard units.
 const travelSpeed=gait=>{const m=gaitMetrics[gait];if(!m)return speed;const r=m.canvas.getBoundingClientRect();const scale=Math.min(r.width/m.artboardWidth,r.height/m.artboardHeight);return Number.isFinite(scale)&&scale>0?m.distancePerCycle/m.cycleSeconds*scale:0;};
 let x=0,frame=null,trip=null,disposed=false;
 const bound=value=>Math.max(0,Math.min(value,Math.max(0,container.clientWidth-element.offsetWidth)));
 const place=value=>{x=bound(value);element.style.left=`${x}px`;};
 function stop(reason='cancelled'){
  if(frame!==null)cancelAnimationFrame(frame);frame=null;
  if(!trip)return;
  const old=trip;trip=null;
  const s=character.presentationState();
  if(s.available&&s.live&&s.statusCode<4&&!s.reducedMotion&&s.movement===old.code){try{character.setMovement('still')}catch{}}
  old.resolve({reason,x});
 }
 function advance(now){
  frame=null;if(!trip||disposed)return;
  const s=character.presentationState();
  if(!s.available||!s.live||s.statusCode>=4||s.reducedMotion||s.movement!==(trip.turnDelay>0?0:trip.code)||s.facing!==trip.direction){stop('interrupted');return;}
  if(trip.turnDelay>0){if(trip.turnStarted===null)trip.turnStarted=now;if(now-trip.turnStarted<trip.turnDelay){trip.last=now;frame=requestAnimationFrame(advance);return;}trip.turnDelay=0;try{character.setMovement(trip.gait)}catch{stop('interrupted');return;}trip.last=now;}
  const target=bound(trip.target);const dt=trip.last===null?0:Math.max(0,now-trip.last);trip.last=now;
  const step=travelSpeed(trip.gait)*dt/1000;const delta=target-x;place(Math.abs(delta)<=step?target:x+Math.sign(delta)*step);
  if(Math.abs(target-x)<0.01){stop('arrived');return;}
  frame=requestAnimationFrame(advance);
 }
 place(initialX);
 return {
  walkTo(target,{gait='walk'}={}){
   if(disposed)throw new Error('Walker disposed');
   if(!Number.isFinite(target))throw new TypeError('Expected finite target');
   if(!['walk','run'].includes(gait))throw new TypeError('Expected walk or run');
   const s=character.presentationState();if(!s.available||!s.live||s.statusCode>=4||s.reducedMotion)throw new Error('Character cannot travel in the current state');
   const interruptedTurn=trip!==null&&trip.turnDelay>0;stop('replaced');target=bound(target);if(Math.abs(target-x)<0.01)return Promise.resolve({reason:'arrived',x});
   const direction=target>x?1:2;const delay=interruptedTurn?reverseTurnDelayMs:s.facing===direction?0:(s.facing===1||s.facing===2)?reverseTurnDelayMs:turnDelayMs;if(delay)character.setMovement('still');character.setFacing(direction===1?'right':'left');if(!delay)character.setMovement(gait);
   return new Promise(resolve=>{trip={target,direction,code:gait==='walk'?1:4,gait,last:null,resolve,turnDelay:delay,turnStarted:null};frame=requestAnimationFrame(advance);});
  },
  cancel(){stop('cancelled');},
  position(){return x;},
  dispose(){if(disposed)return;stop('disposed');disposed=true;}
 };
}
