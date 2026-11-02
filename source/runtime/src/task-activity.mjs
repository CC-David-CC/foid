const CODES=Object.freeze({read:1,type:2,take_notes:3});
/** Per-instance presentation state; only accepted, fresh task cues can start an activity. */
export class TaskActivity {
 constructor(){this.code=0;this.taskId=null;}
 clear(){this.code=0;this.taskId=null;}
 accept(snapshot,{wasLive,replay,newCue}){
  if(!wasLive){this.clear();return false;}
  if(this.taskId&&!snapshot.tasks.some(t=>t.id===this.taskId&&t.phase==='running'))this.clear();
  if(!newCue||replay)return false;
  this.clear();
  const cue=snapshot.cue,code=CODES[cue?.kind];
  if(code&&snapshot.tasks.some(t=>t.id===cue.taskId&&t.phase==='running')){this.code=code;this.taskId=cue.taskId;return true;}
  return false;
 }
}
