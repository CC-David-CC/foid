import {Rive,Layout,Fit,Alignment,RuntimeLoader} from '@rive-app/webgl2';
import wasmUrl from '@rive-app/webgl2/rive.wasm?url';
import {CharacterController,CAST} from './control.mjs';
import {bindCharacter} from './rive-binding.mjs';
import {TaskActivity} from './task-activity.mjs';
import {normalizeSpeech} from './speech.mjs';
import './style.css';
const FOID_FACING=Object.freeze({front:0,right:1,left:2,back:3});
const FOID_MOVEMENTS=Object.freeze({still:0,walk:1,fidget:2,dance:3,run:4,doze:5,sleep:6,sit:7,sit_type:8});
const FOID_EXPRESSION_SETS=Object.freeze({base:Object.freeze({neutral:0,playful:1,teasing:2}),extended:Object.freeze({neutral:0,playful:1,teasing:2,happy:3,thinking:4,surprised:5,sleepy:6,pouty:7})});
RuntimeLoader.setWasmUrl(wasmUrl);
function localAsset(value){const u=new URL(value,document.baseURI);if(u.origin!==location.origin||!['http:','https:'].includes(u.protocol))throw new TypeError('Asset must be same-origin');return u.href;}
export function mount(host){
 if(typeof host?.ui?.make!=='function')throw new TypeError('host.ui.make(tag) required');
 const controller=new CharacterController(host),profile=CAST[host.characterId];
 if(host.expressionProfile!==undefined&&(host.characterId!=='foid'||!Object.hasOwn(FOID_EXPRESSION_SETS,host.expressionProfile)))throw new TypeError('Invalid expression profile');
 const expressions=FOID_EXPRESSION_SETS[host.expressionProfile??'base'];
 if(host.speechProfile!==undefined&&host.speechProfile!=='viseme-v1')throw new TypeError('Invalid speech profile');
 const speechEnabled=host.speechProfile==='viseme-v1';
 if(host.movementProfile!==undefined&&(host.characterId!=='foid'||!['foid-v1','foid-v2','foid-v3','foid-v4','foid-v5','foid-v6','foid-v7'].includes(host.movementProfile)))throw new TypeError('Invalid movement profile');
 const movementEnabled=host.movementProfile==='foid-v1'||host.movementProfile==='foid-v2'||host.movementProfile==='foid-v3'||host.movementProfile==='foid-v4'||host.movementProfile==='foid-v5'||host.movementProfile==='foid-v6'||host.movementProfile==='foid-v7';
 const movementVersionRequired=host.movementProfile==='foid-v7'?7:host.movementProfile==='foid-v6'?6:host.movementProfile==='foid-v5'?5:host.movementProfile==='foid-v4'?4:host.movementProfile==='foid-v3'?3:host.movementProfile==='foid-v2'?2:1;
 if(host.sleepLayout!==undefined&&(host.sleepLayout!=='wide-v1'||host.characterId!=='foid'||movementVersionRequired<5))throw new TypeError('Invalid sleep layout');
 const wideSleep=host.sleepLayout==='wide-v1';
 if(host.seatedTypeCues!==undefined&&(host.seatedTypeCues!==true||host.characterId!=='foid'||movementVersionRequired<7))throw new TypeError('Invalid seated type cue profile');
 const seatedTypeCues=host.seatedTypeCues===true;
 if(host.faceProfile!==undefined&&(host.characterId!=='foid'||host.faceProfile!=='foid-v1'))throw new TypeError('Invalid face profile');
 const faceEnabled=host.faceProfile==='foid-v1';
 if(host.actionProfile!==undefined&&(host.characterId!=='foid'||!['drink-v1','foid-play-v1','foid-notes-v1','foid-cheer-v1'].includes(host.actionProfile)))throw new TypeError('Invalid action profile');
 const drinkEnabled=host.actionProfile==='drink-v1'||host.actionProfile==='foid-play-v1'||host.actionProfile==='foid-notes-v1'||host.actionProfile==='foid-cheer-v1';
 const gameEnabled=host.actionProfile==='foid-play-v1'||host.actionProfile==='foid-notes-v1'||host.actionProfile==='foid-cheer-v1';
 const notesEnabled=host.actionProfile==='foid-notes-v1'||host.actionProfile==='foid-cheer-v1';
 const cheerEnabled=host.actionProfile==='foid-cheer-v1';
 if(host.facingProfile!==undefined&&(host.characterId!=='foid'||host.facingProfile!=='foid-facing-v2'))throw new TypeError('Invalid facing profile');
 const facingEnabled=host.facingProfile==='foid-facing-v2';
 if(host.taskActivityProfile!==undefined&&(host.characterId!=='foid'||host.taskActivityProfile!=='foid-task-v1'))throw new TypeError('Invalid task activity profile');
 const taskActivityEnabled=host.taskActivityProfile==='foid-task-v1',taskActivity=new TaskActivity();let appliedTaskActivity=null;
 const asset=localAsset(host.assetUrl??`./characters/${profile.file}`),abort=new AbortController();
 let seatedTaskId=null;let disposed=false,failed=false,rive=null,binding=null,observer=null,watchdog=null,loadTimeout=null,userReduced=false,expression=0,appliedExpression=null,speech={speaking:false,visemeCode:0},appliedSpeech=null,movement=0,appliedMovement=null,appliedWideLayout=null,blush=0.5,appliedBlush=null,facing=0,appliedFacing=null;
 let resolveReady,rejectReady;const ready=new Promise((a,b)=>{resolveReady=a;rejectReady=b;});ready.catch(()=>{});
 const media=matchMedia('(prefers-reduced-motion: reduce)'),make=t=>host.ui.make(t);
 const element=make('section'),stage=make('div'),canvas=make('canvas'),label=make('p'),button=make('button');
 element.className='cast-character';stage.className='cast-stage';canvas.className='cast-canvas';label.className='cast-status';
 element.setAttribute('aria-label',profile.name+' — '+profile.role);canvas.setAttribute('aria-hidden','true');
 label.setAttribute('role','status');label.setAttribute('aria-live','polite');button.type='button';button.textContent='Inspect '+profile.name;button.disabled=typeof host.onInspect!=='function';
 stage.append(canvas);element.append(stage,label,button);
 function release(){abort.abort();observer?.disconnect();clearInterval(watchdog);clearTimeout(loadTimeout);rive?.cleanup();rive=null;binding=null;}
 function fail(error){if(disposed||failed)return;failed=true;controller.disconnect();release();button.disabled=true;label.textContent=profile.name+' unavailable: '+String(error?.message??error);rejectReady(error);}
 function update(trigger=null){if(disposed||failed)return;try{const s=controller.state();if(s.statusCode!==2)taskActivity.clear();if(s.statusCode>=4){facing=0;seatedTaskId=null;}if(s.statusCode>=4||(s.reducedMotion&&!((movement===5&&movementVersionRequired>=4)||(movement===6&&movementVersionRequired>=5)||((movement===7&&movementVersionRequired>=6)||(movement===8&&movementVersionRequired>=7)))))movement=0;if(s.statusCode===5){blush=0.5;expression=0;speech={speaking:false,visemeCode:0};}if(wideSleep){const wide=movement===6;element.classList.toggle('cast-character--sleep-wide',wide);if(rive&&appliedWideLayout!==wide){rive.layout=new Layout({fit:wide?Fit.Cover:Fit.Contain,alignment:wide?Alignment.BottomCenter:Alignment.Center});appliedWideLayout=wide;rive.resizeDrawingSurfaceToCanvas();}}binding?.apply(s,document.hidden?null:trigger);if(binding&&taskActivityEnabled&&appliedTaskActivity!==taskActivity.code){binding.setTaskActivity(taskActivity.code);appliedTaskActivity=taskActivity.code;}if(binding&&facingEnabled&&appliedFacing!==facing){binding.setFacing(facing);appliedFacing=facing;}if(binding&&faceEnabled&&appliedBlush!==blush){binding.setBlush(blush);appliedBlush=blush;}if(binding&&movementEnabled&&appliedMovement!==movement){binding.setMovement(movement);appliedMovement=movement;}if(binding&&speechEnabled&&(!appliedSpeech||appliedSpeech.speaking!==speech.speaking||appliedSpeech.visemeCode!==speech.visemeCode)){binding.setSpeech(speech.speaking,speech.visemeCode);appliedSpeech={...speech};}if(binding&&host.characterId==='foid'&&appliedExpression!==expression){binding.setExpression(expression);appliedExpression=expression;}if(label.textContent!==s.label)label.textContent=s.label;}catch(e){fail(e);}}
 function reduce(){controller.setReducedMotion(userReduced||media.matches);update();}
 function visibility(){if(disposed||failed)return;controller.disconnect();update();if(document.hidden)rive?.pause();else rive?.play();}
 media.addEventListener('change',reduce,{signal:abort.signal});document.addEventListener('visibilitychange',visibility,{signal:abort.signal});
 button.addEventListener('click',()=>{if(!disposed&&!failed&&typeof host.onInspect==='function')Promise.resolve().then(()=>host.onInspect({worldId:host.worldId,characterId:host.characterId})).catch(e=>{if(!disposed&&!failed)label.textContent='Inspection request failed: '+String(e.message);});},{signal:abort.signal});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail(new Error('Graphics context lost; remount required'));},{signal:abort.signal});
 observer=new ResizeObserver(()=>{if(!disposed&&!failed)rive?.resizeDrawingSurfaceToCanvas();});observer.observe(stage);
 reduce();watchdog=setInterval(update,200);loadTimeout=setTimeout(()=>fail(new Error('Rive asset/runtime load timed out')),20000);
 fetch(asset,{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('Missing '+profile.file+' ('+r.status+')');return r.arrayBuffer();}).then(buffer=>{
  if(disposed||failed)return;
  rive=new Rive({buffer,canvas,artboard:profile.artboard,stateMachine:profile.stateMachine,autoBind:false,autoplay:!document.hidden,useOffscreenRenderer:true,enableRiveAssetCDN:false,shouldDisableRiveListeners:true,layout:new Layout({fit:Fit.Contain,alignment:Alignment.Center}),
   onLoad(){queueMicrotask(()=>{if(disposed||failed)return;try{binding=bindCharacter(rive,{expressions:host.characterId==='foid',expressionMax:Object.keys(expressions).length-1,speech:speechEnabled,movement:movementEnabled,face:faceEnabled,drink:drinkEnabled,game:gameEnabled,notes:notesEnabled,cheer:cheerEnabled,facing:facingEnabled,taskActivity:taskActivityEnabled,movementVersionRequired});clearTimeout(loadTimeout);rive.resizeDrawingSurfaceToCanvas();update();resolveReady();}catch(e){fail(e);}});},
   onLoadError(e){fail(new Error('Rive load failed: '+String(e?.data??'invalid binary/runtime')));}});
 }).catch(e=>{if(!disposed&&!failed)fail(e);});
 return {element,ready,
  presentationState(){if(!disposed&&!failed)update();const s=controller.state();return Object.freeze({available:!disposed&&!failed,live:!disposed&&!failed&&controller.live(),statusCode:s.statusCode,reducedMotion:s.reducedMotion,movement,facing});},
  accept(snapshot,remainingMs,options={}){if(disposed||failed)throw new Error('Character unavailable');if(snapshot?.cue?.kind==='drink'&&!drinkEnabled)throw new Error('Drink action not supported by this presentation profile');if(snapshot?.cue?.kind==='play_game'&&!gameEnabled)throw new Error('Game action not supported by this presentation profile');if(snapshot?.cue?.kind==='take_notes'&&!notesEnabled)throw new Error('Notes action not supported by this presentation profile');if(snapshot?.cue?.kind==='cheer'&&!cheerEnabled)throw new Error('Cheer action not supported by this presentation profile');const wasLive=controller.live(),priorCueSequence=controller.cueSequence;const result=controller.accept(snapshot,remainingMs,options);if(result.accepted){const seatedType=seatedTypeCues&&wasLive&&!options.replay&&controller.cueSequence>priorCueSequence&&snapshot.cue?.kind==='type'&&(movement===7||movement===8);if(seatedType)taskActivity.clear();const startedActivity=!seatedType&&taskActivityEnabled&&taskActivity.accept(snapshot,{wasLive,replay:!!options.replay,newCue:controller.cueSequence>priorCueSequence});if(startedActivity){facing=0;movement=0;seatedTaskId=null;}if(!wasLive){facing=0;blush=0.5;movement=0;expression=0;speech={speaking:false,visemeCode:0};}if(seatedTaskId&&!snapshot.tasks.some(t=>t.id===seatedTaskId&&t.phase==='running')){if(movement===8)movement=7;seatedTaskId=null;}if(seatedType){movement=8;seatedTaskId=snapshot.cue.taskId;}else if(result.trigger==='gesture'){facing=0;movement=0;seatedTaskId=null;}update(seatedType||startedActivity?null:result.trigger);}return result;},
  disconnect(){taskActivity.clear();seatedTaskId=null;controller.disconnect();update();},
  blink(){if(disposed||failed)throw new Error('Character unavailable');if(!controller.live())throw new Error('Blink requires a live character');update('blink');},
  setFacing(name){if(disposed||failed)throw new Error('Character unavailable');if(!facingEnabled)throw new Error('Facing not supported');if(typeof name!=='string'||!Object.hasOwn(FOID_FACING,name))throw new TypeError('Unknown facing');if(name!=='front'&&!controller.live())throw new Error('Facing requires a live character');if(name!=='front'&&controller.state().statusCode>=4)throw new Error('Facing unavailable in the current state');if(name!=='front'&&(movement===5||movement===6))movement=0;if((movement===7||movement===8)&&name!=='left'&&name!=='right'){movement=0;seatedTaskId=null;}if(name!=='front')taskActivity.clear();facing=FOID_FACING[name];update();},
  setBlush(value){if(disposed||failed)throw new Error('Character unavailable');if(!faceEnabled)throw new Error('Blush not supported');if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)throw new TypeError('Invalid blush');if(value!==0.5&&!controller.live())throw new Error('Blush requires a live character');blush=value;update();},
  setMovement(name){if(disposed||failed)throw new Error('Character unavailable');if(!movementEnabled)throw new Error('Movement not supported');if(typeof name!=='string'||!Object.hasOwn(FOID_MOVEMENTS,name))throw new TypeError('Unknown movement');if(name==='run'&&movementVersionRequired<2)throw new Error('Run not supported by this movement profile');if(name==='doze'&&movementVersionRequired<3)throw new Error('Doze not supported by this movement profile');if(name==='sleep'&&movementVersionRequired<5)throw new Error('Sleep not supported by this movement profile');if(name==='sit_type'&&movementVersionRequired<7)throw new Error('Seated typing not supported by this movement profile');if(name==='sit'&&movementVersionRequired<6)throw new Error('Sit not supported by this movement profile');if(name!=='still'&&!controller.live())throw new Error('Movement requires a live character');const current=controller.state();if(name!=='still'&&(current.statusCode>=4||(current.reducedMotion&&!((name==='doze'&&movementVersionRequired>=4)||(name==='sleep'&&movementVersionRequired>=5)||((name==='sit'&&movementVersionRequired>=6)||(name==='sit_type'&&movementVersionRequired>=7))))))throw new Error('Movement unavailable in the current state');if(name==='doze'||name==='sleep'){facing=0;speech={speaking:false,visemeCode:0};}if(name==='sit'||name==='sit_type')facing=facing===2?2:1;if(name!=='sit_type')seatedTaskId=null;if(name!=='still')taskActivity.clear();movement=FOID_MOVEMENTS[name];update();},
  setExpression(name){if(disposed||failed)throw new Error('Character unavailable');if(host.characterId!=='foid')throw new Error('Expressions not supported');if(typeof name!=='string'||!Object.hasOwn(expressions,name))throw new TypeError('Unknown expression');if(!controller.live()&&name!=='neutral')throw new Error('Expression requires a live character');const repeat=(name==='teasing'||name==='happy')&&expression===expressions[name]&&controller.live()&&!controller.state().reducedMotion&&controller.state().statusCode<4&&!document.hidden;expression=expressions[name];update();if(repeat){if(name==='teasing')binding?.repeatTease();else binding?.repeatHappy();}},
  setSpeech(input){if(disposed||failed)throw new Error('Character unavailable');if(!speechEnabled)throw new Error('Speech not supported');const next=normalizeSpeech(input);if(next.speaking&&!controller.live())throw new Error('Speech requires a live character');if(next.speaking&&(movement===5||movement===6))movement=0;speech=next;update();},
  setReducedMotion(value){if(typeof value!=='boolean')throw new TypeError('Expected boolean');userReduced=value;reduce();},
  dispose(){if(disposed)return;disposed=true;release();controller.dispose();element.remove();rejectReady(new DOMException('Disposed before ready','AbortError'));}
 };
}

export {createDesktopWalker} from "./desktop-walker.mjs";

export {placeContainedAnchor} from "./contained-anchor.mjs";
export {placeSurfaceUnderAnchor} from './contained-anchor.mjs';
