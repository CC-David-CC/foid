import foidUrl from '../qualification/foid-experiment-374.riv?url';
import {mount as mountCharacter,createDesktopWalker} from '../src/mount.mjs';
import {fixture} from '../src/control.mjs';

const PHASES={read:'running',type:'running',take_notes:'running',explain:'succeeded',acknowledge:'succeeded',cancel:'cancelled'};
const PERSONAL=new Set(['greet','cheer','drink','play_game']);
/** Mount synchronously; await avatar.ready before invoking steering methods. */
export function mount(host,options={}){
 if(!(host instanceof Element))throw new TypeError('mount(host) requires a DOM element');
 const worldId=options.worldId??'website',sessionId=options.sessionId??`foid-${crypto.randomUUID()}`;
 const character=mountCharacter({worldId,characterId:'foid',sessionId,expressionProfile:'extended',speechProfile:'viseme-v1',movementProfile:'foid-v7',faceProfile:'foid-v1',actionProfile:'foid-cheer-v1',taskActivityProfile:'foid-task-v1',seatedTypeCues:true,facingProfile:'foid-facing-v2',assetUrl:options.assetUrl??foidUrl,ui:{make:tag=>document.createElement(tag)}});
 const style=document.createElement('style');style.textContent='.foid-embed{position:relative;display:block;width:100%;height:100%;min-height:1px}.foid-embed .cast-character,.foid-embed .cast-stage{width:100%;height:100%;position:relative}.foid-embed .cast-canvas{display:block;width:100%;height:100%}.foid-embed .cast-status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.foid-embed button{display:none}';
 const container=document.createElement('div');container.className='foid-embed';container.append(style,character.element);host.append(container);
 let sequence=0,cueSequence=0,disposed=false,last={tasks:[],attention:false,condition:'unknown',summary:'Ready',look:{x:0,y:0},headTilt:0,energy:.6,motionAmount:.5},leaseMs=options.leaseMs??30000;
 if(!Number.isInteger(leaseMs)||leaseMs<1||leaseMs>30000){character.dispose();container.remove();throw new TypeError('leaseMs must be an integer from 1 to 30000')}
 function update(patch={}){if(disposed)throw Error('Foid is disposed');if(!patch||typeof patch!=='object'||Array.isArray(patch))throw TypeError('Expected update object');const {cue,...fields}=patch;const next={...last,...fields};const snapshot=fixture('foid',{worldId,sessionId,sequence:sequence+1,leaseMs,...next,cue:cue??null});const result=character.accept(snapshot,leaseMs);if(result.accepted){sequence++;last=next}return result}
 function setStatus(status){const phases={idle:null,listening:null,working:'running',waiting:'waiting',error:'failed'};if(status==='disconnected'){character.disconnect();return}if(!Object.hasOwn(phases,status))throw TypeError('Unknown status');const phase=phases[status];return update({tasks:phase?[{id:'host-task',phase,label:'Host task'}]:[],attention:status==='listening',condition:status==='error'?'error':'unknown',summary:status[0].toUpperCase()+status.slice(1)})}
 function gesture(kind,task){if(!PERSONAL.has(kind)&&!Object.hasOwn(PHASES,kind))throw TypeError('Unknown gesture');let tasks=last.tasks,taskId=null;if(Object.hasOwn(PHASES,kind)){taskId=task?.taskId;const phase=PHASES[kind];if(typeof taskId!=='string'||!tasks.some(t=>t.id===taskId&&t.phase===phase))throw Error(`${kind} requires an existing ${phase} task with matching taskId`)}return update({cue:{sequence:++cueSequence,kind,taskId},tasks})}
 const ready=character.ready.then(()=>{if(!disposed)update();return api});
 const api={element:container,ready,update,setStatus,gesture,blink:()=>character.blink(),setLook:(x,y)=>update({look:{x,y}}),setHeadTilt:value=>update({headTilt:value}),setEnergy:value=>update({energy:value}),setMotionAmount:value=>update({motionAmount:value}),setExpression:name=>character.setExpression(name),setFacing:name=>character.setFacing(name),setMovement:name=>character.setMovement(name),setBlush:value=>character.setBlush(value),setSpeech:value=>character.setSpeech(value),setReducedMotion:value=>character.setReducedMotion(value),presentationState:()=>character.presentationState(),disconnect:()=>character.disconnect(),dispose(){if(disposed)return;disposed=true;character.dispose();container.remove()}};
 return api;
}
export {createDesktopWalker};
