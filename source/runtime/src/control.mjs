import catalog from '../../spec/cast.json' with {type:'json'};
export const CAST=catalog.characters;
export const STATUS=Object.freeze({idle:0,listening:1,working:2,waiting:3,error:4,disconnected:5});
export const CONDITIONS=Object.freeze({unknown:0,ok:1,degraded:2,error:3});
const PHASES=new Set(['queued','running','waiting','succeeded','failed','cancelled']);
const ID=/^[A-Za-z0-9_.:-]{1,96}$/;
export function identifier(v){if(typeof v!=='string'||!ID.test(v))throw new TypeError('Invalid identifier');return v;}
function record(o,keys,name){if(!o||typeof o!=='object'||Array.isArray(o)||Object.getPrototypeOf(o)!==Object.prototype)throw new TypeError(name+' must be a plain object');const actual=Object.keys(o);if(actual.length!==keys.length||actual.some(k=>!keys.includes(k)))throw new TypeError(name+' has missing/unknown fields');}
function text(v,name){if(typeof v!=='string'||!v.trim()||v.length>160||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw new TypeError('Invalid '+name);}
function num(v,min,max,name){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new TypeError('Invalid '+name);}
function integer(v,min,max,name){if(!Number.isSafeInteger(v)||v<min||v>max)throw new TypeError('Invalid '+name);}
export function validateSnapshot(input){
 record(input,['schema','worldId','characterId','sessionId','sequence','leaseMs','tasks','attention','condition','summary','look','headTilt','energy','motionAmount','cue'],'snapshot');
 if(input.schema!==1)throw new TypeError('Unsupported schema');
 for(const key of ['worldId','characterId','sessionId'])identifier(input[key]);
 if(!Object.hasOwn(CAST,input.characterId))throw new TypeError('Unknown character');
 integer(input.sequence,1,Number.MAX_SAFE_INTEGER,'sequence');integer(input.leaseMs,1,30000,'lease');
 if(typeof input.attention!=='boolean'||!Object.hasOwn(CONDITIONS,input.condition))throw new TypeError('Invalid attention/condition');text(input.summary,'summary');
 record(input.look,['x','y'],'look');num(input.look.x,-1,1,'look x');num(input.look.y,-1,1,'look y');
 num(input.headTilt,-1,1,'head tilt');num(input.energy,0,1,'energy');num(input.motionAmount,0,1,'motion amount');
 if(!Array.isArray(input.tasks)||input.tasks.length>32)throw new TypeError('Invalid task list');
 const ids=new Set();for(const t of input.tasks){record(t,['id','phase','label'],'task');identifier(t.id);text(t.label,'task label');if(ids.has(t.id)||!PHASES.has(t.phase))throw new TypeError('Duplicate task/invalid phase');ids.add(t.id);}
 if(input.cue!==null){const c=input.cue;record(c,['sequence','kind','taskId'],'cue');integer(c.sequence,1,Number.MAX_SAFE_INTEGER,'cue sequence');
  if(typeof c.kind!=='string'||!Object.hasOwn(CAST[input.characterId].actions,c.kind))throw new TypeError('Unknown character action');
  const action=CAST[input.characterId].actions[c.kind];
  if(action.phases.length===0){if(c.taskId!==null)throw new TypeError('Task-free cue needs null task');}
  else {identifier(c.taskId);const task=input.tasks.find(t=>t.id===c.taskId);if(!task||!action.phases.includes(task.phase))throw new TypeError('Cue has no matching authoritative task phase');}
 }
 return structuredClone(input);
}
export function fixture(characterId,patch={}){
 if(!Object.hasOwn(CAST,characterId))throw new TypeError('Unknown character');
 return {schema:1,worldId:'demo',characterId,sessionId:'demo-session',sequence:1,leaseMs:5000,tasks:[],attention:false,condition:'unknown',summary:'SIMULATED — Ready',look:{x:0,y:0},headTilt:0,energy:0.3,motionAmount:0.35,cue:null,...patch};
}
/** Pure presentation state. Does not execute jobs or authorize operations. */
export class CharacterController{
 constructor({worldId,characterId,sessionId,clock=()=>performance.now()}){
  [worldId,characterId,sessionId].forEach(identifier);if(!Object.hasOwn(CAST,characterId)||typeof clock!=='function')throw new TypeError('Invalid controller setup');
  this.worldId=worldId;this.characterId=characterId;this.sessionId=sessionId;this.clock=clock;this.snapshot=null;this.sequence=0;this.cueSequence=0;this.cueSignature=null;this.deadline=0;this.connected=false;this.reduced=false;this.disposed=false;
 }
 live(){return !this.disposed&&this.connected&&this.snapshot!==null&&this.clock()<this.deadline;}
 remaining(){return this.live()?Math.max(0,this.deadline-this.clock()):0;}
 accept(input,remainingMs,{replay=false}={}){
  if(this.disposed)throw new Error('Disposed');if(typeof replay!=='boolean')throw new TypeError('Invalid replay flag');
  const s=validateSnapshot(input);if(s.worldId!==this.worldId||s.characterId!==this.characterId||s.sessionId!==this.sessionId)throw new TypeError('Wrong world/character/session');
  num(remainingMs,0,s.leaseMs,'remaining lease');if(s.sequence<=this.sequence)return {accepted:false,reason:'stale',trigger:null};
  if(remainingMs===0)return {accepted:false,reason:'expired',trigger:null};
  const wasLive=this.live();let trigger=null;
  if(s.cue){const sig=JSON.stringify([s.cue.kind,s.cue.taskId]);
   if(s.cue.sequence<this.cueSequence)throw new TypeError('Cue sequence regression');
   if(s.cue.sequence===this.cueSequence&&sig!==this.cueSignature)throw new TypeError('Cue sequence reused for different content');
   if(s.cue.sequence>this.cueSequence){if(wasLive&&!replay&&!this.reduced)trigger='gesture';this.cueSequence=s.cue.sequence;this.cueSignature=sig;}
  }
  this.snapshot=s;this.sequence=s.sequence;this.deadline=this.clock()+remainingMs;this.connected=true;
  return {accepted:true,reason:'accepted',trigger};
 }
 setReducedMotion(value){if(typeof value!=='boolean')throw new TypeError('Expected boolean');this.reduced=value;}
 disconnect(){this.connected=false;this.deadline=0;}
 state(){
  const live=this.live(),s=live?this.snapshot:null,counts={queued:0,running:0,waiting:0,succeeded:0,failed:0,cancelled:0};
  if(s)for(const t of s.tasks)counts[t.phase]++;
  const phase=!s?'disconnected':counts.failed?'error':counts.running?'working':counts.queued+counts.waiting?'waiting':s.attention?'listening':'idle';
  const condition=s?.condition??'unknown';
  const label=s?`${CAST[this.characterId].name}: ${s.summary} · ${phase} · ${counts.running} active · ${counts.queued+counts.waiting} waiting · condition ${condition}`:`${CAST[this.characterId].name}: Disconnected — no fresh supervisor state`;
  return {status:phase,statusCode:STATUS[phase],conditionCode:CONDITIONS[condition],lookX:s?.look.x??0,lookY:s?.look.y??0,headTilt:s?.headTilt??0,energy:s?.energy??0,motionAmount:s&&!this.reduced?s.motionAmount:0,gestureCode:s?.cue?CAST[this.characterId].actions[s.cue.kind].code:0,reducedMotion:this.reduced,label,counts};
 }
 dispose(){if(this.disposed)return;this.disconnect();this.snapshot=null;this.disposed=true;}
}
