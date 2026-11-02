/**
 * Position an absolutely positioned host so an artboard point meets a target
 * in the positioned container's content coordinates. Assumes Rive Fit.Contain,
 * centered alignment, an untransformed host/canvas, and no scrolled container.
 * This moves only the host; it does not change or animate a Rive character.
 */
export function placeContainedAnchor({host,canvas,container,artboard,anchor,target,mirror=false}){
 if(!host?.style||typeof host.getBoundingClientRect!=='function'||typeof canvas?.getBoundingClientRect!=='function'||typeof container?.getBoundingClientRect!=='function')throw new TypeError('Expected positioned host, canvas, and container');
 if(typeof mirror!=='boolean'||![artboard?.width,artboard?.height].every(v=>Number.isFinite(v)&&v>0)||![anchor?.x,anchor?.y,target?.x,target?.y].every(Number.isFinite))throw new TypeError('Invalid anchor placement');
 if(anchor.x<0||anchor.x>artboard.width||anchor.y<0||anchor.y>artboard.height)throw new RangeError('Anchor outside artboard');
 const c=canvas.getBoundingClientRect(),h=host.getBoundingClientRect();
 if(!Number.isFinite(c.width)||!Number.isFinite(c.height)||c.width<=0||c.height<=0)throw new Error('Canvas must have a visible size');
 const scale=Math.min(c.width/artboard.width,c.height/artboard.height),x=mirror?artboard.width-anchor.x:anchor.x;
 const left=target.x-(c.left-h.left)-(c.width-artboard.width*scale)/2-x*scale;
 const top=target.y-(c.top-h.top)-(c.height-artboard.height*scale)/2-anchor.y*scale;
 host.style.left=`${left}px`;host.style.top=`${top}px`;return Object.freeze({left,top,scale});
}

/** Place a positioned surface beneath an artboard point without moving the character.
 * Assumes Fit.Contain, centered alignment, untransformed elements, and no container scroll.
 * `offset` locates the point of contact relative to the surface's top-left corner.
 */
export function placeSurfaceUnderAnchor({surface,canvas,container,artboard,anchor,offset={x:0,y:0},mirror=false}){
 if(!surface?.style||typeof canvas?.getBoundingClientRect!=='function'||typeof container?.getBoundingClientRect!=='function')throw new TypeError('Expected surface, canvas, and container');
 if(typeof mirror!=='boolean'||![artboard?.width,artboard?.height].every(v=>Number.isFinite(v)&&v>0)||![anchor?.x,anchor?.y,offset?.x,offset?.y].every(Number.isFinite))throw new TypeError('Invalid surface placement');
 if(anchor.x<0||anchor.x>artboard.width||anchor.y<0||anchor.y>artboard.height)throw new RangeError('Anchor outside artboard');
 const c=canvas.getBoundingClientRect(),d=container.getBoundingClientRect();
 if(![c.left,c.top,c.width,c.height,d.left,d.top,container.clientLeft,container.clientTop].every(Number.isFinite)||c.width<=0||c.height<=0)throw new Error('Canvas and container must have visible geometry');
 const scale=Math.min(c.width/artboard.width,c.height/artboard.height),x=mirror?artboard.width-anchor.x:anchor.x;
 const contactX=c.left-d.left-container.clientLeft+(c.width-artboard.width*scale)/2+x*scale;
 const contactY=c.top-d.top-container.clientTop+(c.height-artboard.height*scale)/2+anchor.y*scale;
 const left=contactX-offset.x,top=contactY-offset.y;surface.style.left=`${left}px`;surface.style.top=`${top}px`;
 return Object.freeze({left,top,contactX,contactY,scale});
}
