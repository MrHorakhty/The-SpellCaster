import { awaitBoard } from '../lib/page.mjs';

// Drive the real file input with DataTransfer: no OS picker or test-only app API.
// Canvas fixtures and pixel reads work under built preview as well as native dev.
export const iconprep = {
  title: 'SUITE ICON: ICON PREPARATION',
  async run(ctx) {
    const { log, reload, sleep, driver, submitModal, isTauri } = ctx;
    const evalJs = async expression => {
      const value = await ctx.evalJs(expression);
      if (value?.__error) throw new Error(value.__error);
      return value;
    };
    const waitFor = async expression => {
      for (let i = 0; i < 100; i++) {
        if (await evalJs(expression)) return true;
        await sleep(100);
      }
      return false;
    };
    const seed = `(() => {
      localStorage.setItem(window.__pk('ttrpg_characters'),JSON.stringify([{id:'ip_char',name:'Icon Tests',sounds:[{
        id:'ip_sound',name:'Icon Probe',icon:'Caustic_Blast_Acid.png',color:'#84cc16',brightness:1,
        files:[{name:'Longbow_4.mp3',displayName:'Longbow_4.mp3'}]}]}]));
      localStorage.setItem(window.__pk('ttrpg_environment'),'[]');
      localStorage.setItem(window.__pk('ttrpg_groups'),'[]');
      return true;
    })()`;
    try {
      await evalJs(seed); await reload(); await awaitBoard(ctx, { min: 1, seed });
      await driver.enterEditMode();
      await evalJs(`document.querySelector('[data-sound-id="ip_sound"]').parentElement.querySelector('button[title="Edit Sound"]').click()`);
      await waitFor(`!!document.querySelector('[data-sound-modal-close]')`);
      await evalJs(`(() => {
        window.__ipOriginalIcon = document.querySelector('img[alt="Icon preview"]').getAttribute('src');
        window.__ipNativeImage=window.Image;window.__ipDecodes=0;
        window.Image=function(...args){window.__ipDecodes++;return new window.__ipNativeImage(...args)};
        window.Image.prototype=window.__ipNativeImage.prototype;
        window.__ipUpload = async (kind = 'dark') => {
          const canvas = document.createElement('canvas'); canvas.width=400; canvas.height=200;
          const c=canvas.getContext('2d'); c.fillStyle=kind==='light'?'white':'black'; c.fillRect(0,0,400,200);
          if(kind==='crop') { c.fillStyle='red'; c.fillRect(0,0,200,200); c.fillStyle='blue'; c.fillRect(200,0,200,200); }
          else if(kind!=='empty') { c.fillStyle=kind==='light'?'black':'white'; c.fillRect(50,50,100,100); c.fillRect(250,50,60,60); }
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
          window.__ipBytes=Array.from(new Uint8Array(await blob.arrayBuffer()));
          const dt=new DataTransfer(); dt.items.add(new File([blob],'icon-test.png',{type:'image/png'}));
          const input=document.querySelector('input[type="file"][accept*=".svg"]'); input.files=dt.files;
          input.dispatchEvent(new Event('change',{bubbles:true})); return true;
        };
        window.__ipPixels = async (selector) => {
          const image=document.querySelector(selector); if(!image) return null;
          const response=image.tagName==='CANVAS' ? null : await fetch(image.src);
          const blob=response ? await response.blob() : await new Promise(resolve=>image.toBlob(resolve,'image/png'));
          let decoded;
          try { decoded=await createImageBitmap(blob); }
          catch(error) { throw new Error('Pixel decode failed: '+JSON.stringify({selector,src:image.src,status:response?.status,type:blob.type,size:blob.size,complete:image.complete,width:image.naturalWidth,error:String(error)})); }
          const c=document.createElement('canvas');
          c.width=decoded.width;c.height=decoded.height; const g=c.getContext('2d');g.drawImage(decoded,0,0);
          const p=g.getImageData(0,0,c.width,c.height).data; decoded.close();
          let opaque=0,left=0,right=0,grey=true;
          for(let i=0;i<p.length;i+=4) if(p[i+3]>128) {opaque++;if((i/4)%c.width<c.width/2)left++;else right++;
            if(Math.abs(p[i]-106)>1 || Math.abs(p[i+1]-106)>1 || Math.abs(p[i+2]-106)>1)grey=false;}
          const middle=(Math.floor(c.height/2)*c.width+Math.floor(c.width/2))*4;
          return {width:c.width,height:c.height,coverage:opaque/(c.width*c.height),left,right,grey,
            corner:p[3],middle:Array.from(p.slice(middle,middle+4)),bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))};
        }; return true;
      })()`);
      const upload = `(${await evalJs('window.__ipUpload.toString()')})`;
      const pixels = `(${await evalJs('window.__ipPixels.toString()')})`;
      await evalJs(`window.__ipUpload()`);
      const choice = await waitFor(`document.querySelectorAll('[data-icon-mode]').length===3 && !document.querySelector('[data-icon-mode]:disabled')`);
      log('ICON','IP1: upload offers three choices without a default',choice && await evalJs(`!document.querySelector('[data-icon-confirm]')`) ? 'PASS':'FAIL');
      log('ICON','IP2: selection leaves editor and saved sound unchanged',await evalJs(`document.querySelector('img[alt="Icon preview"]').getAttribute('src')===window.__ipOriginalIcon && JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')))[0].sounds[0].icon==='Caustic_Blast_Acid.png'`) ? 'PASS':'FAIL');
      log('ICON','IP3: both small input examples load',await waitFor(`Array.from(document.querySelectorAll('[data-icon-mode="silhouette"] img')).filter(i=>i.complete&&i.naturalWidth===256).length===2`) ? 'PASS':'FAIL');
      await evalJs(`document.querySelector('[data-icon-mode="silhouette"]').click()`);
      await waitFor(`!!document.querySelector('[data-icon-result]')`);
      const dark = await evalJs(`window.__ipPixels('[data-icon-result]')`);
      log('ICON','IP4: dark-background silhouette has neutral art and transparent padding',dark?.width===256 && dark?.height===256 && dark?.grey && dark?.corner===0 && dark.coverage>0.05 && dark.coverage<0.5 ? 'PASS':'FAIL',JSON.stringify({...dark,bytes:undefined}));
      log('ICON','IP5: separate illustration parts both survive',dark?.left>100 && dark?.right>100 ? 'PASS':'FAIL');
      log('ICON','IP6: confirmation distinguishes editor from Save and warns about original',await evalJs(`document.querySelector('[data-icon-prep]').textContent.includes('Save the sound') && document.querySelector('[data-icon-prep]').textContent.includes('not kept for undo')`) ? 'PASS':'FAIL');
      const silhouetteUrl = await evalJs(`document.querySelector('[data-icon-result]').src`);
      await evalJs(`document.querySelector('[data-icon-back]').click()`);
      await waitFor(`!!document.querySelector('[data-icon-mode="silhouette"]')`);
      await evalJs(`document.querySelector('[data-icon-mode="silhouette"]').click()`);
      log('ICON','IP27: returning to silhouette reuses its prepared result',await waitFor(`document.querySelector('[data-icon-result]')?.src===${JSON.stringify(silhouetteUrl)}`) ? 'PASS':'FAIL');
      log('ICON','IP28: selected file is decoded only once across processing and Back',await evalJs(`window.__ipDecodes===1`) ? 'PASS':'FAIL');
      await evalJs(`document.querySelector('[data-icon-cancel]').click()`);
      log('ICON','IP7: cancelling processed preview leaves old icon intact',await waitFor(`!document.querySelector('[data-icon-prep]') && document.querySelector('img[alt="Icon preview"]').getAttribute('src')===window.__ipOriginalIcon`) ? 'PASS':'FAIL');
      await evalJs(`window.__ipUpload('light')`);
      await waitFor(`!!document.querySelector('[data-icon-mode="silhouette"]:not(:disabled)')`);
      await evalJs(`document.querySelector('[data-icon-mode="silhouette"]').click()`);
      await waitFor(`!!document.querySelector('[data-icon-result]')`);
      const light = await evalJs(`window.__ipPixels('[data-icon-result]')`);
      log('ICON','IP8: opposite background polarity gives same silhouette coverage',Math.abs(light?.coverage-dark?.coverage)<0.005 ? 'PASS':'FAIL');
      await evalJs(`document.querySelector('[data-icon-cancel]').click(); window.__ipUpload('empty')`);
      await waitFor(`!!document.querySelector('[data-icon-mode="silhouette"]:not(:disabled)')`);
      await evalJs(`document.querySelector('[data-icon-mode="silhouette"]').click()`);
      log('ICON','IP9: empty silhouette is previewed and can be confirmed',await waitFor(`!!document.querySelector('[data-icon-result]') && !document.querySelector('[data-icon-confirm]').disabled`) ? 'PASS':'FAIL');
      await evalJs(`document.querySelector('[data-icon-cancel]').click(); window.__ipUpload('crop')`);
      await waitFor(`!!document.querySelector('[data-icon-mode="crop"]:not(:disabled)')`);
      await evalJs(`document.querySelector('[data-icon-mode="crop"]').click()`);
      await waitFor(`!!document.querySelector('[data-icon-result]')`);
      const initial = await evalJs(`window.__ipPixels('[data-icon-result]')`);
      await evalJs(`window.__ipCropCanvas=document.querySelector('[data-icon-result]');window.__ipDialogHeight=document.querySelector('[data-icon-prep]').getBoundingClientRect().height`);
      await evalJs(`(() => {const el=document.querySelector('[data-icon-crop]'); el.focus(); for(let i=0;i<40;i++) el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));return true})()`);
      await waitFor(`!!document.querySelector('[data-icon-result]')`);
      const cropped = await evalJs(`window.__ipPixels('[data-icon-result]')`);
      log('ICON','IP10: keyboard crop selects original blue region',cropped?.middle[2]===255 && cropped.middle[0]===0 && initial?.bytes.join(',')!==cropped.bytes.join(',') ? 'PASS':'FAIL');
      const beforeZoom = await evalJs(`parseFloat(document.querySelector('[data-icon-crop] img').style.width)`);
      await evalJs(`document.querySelector('[data-icon-crop]').dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true}))`);
      log('ICON','IP11: keyboard zoom changes crop scale and touch scrolling is disabled',await waitFor(`!!document.querySelector('[data-icon-result]') && document.querySelector('[data-icon-crop]').style.touchAction==='none' && parseFloat(document.querySelector('[data-icon-crop] img').style.width)>${beforeZoom}`) ? 'PASS':'FAIL');
      await evalJs(`document.querySelector('[data-icon-crop]').scrollIntoView({block:'center'})`);
      const bounds = await evalJs(`(() => {const el=document.querySelector('[data-icon-crop]');const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,left:el.querySelector('img').style.left}})()`);
      await driver.dragFromTo({x:bounds.x,y:bounds.y},{x:bounds.x+55,y:bounds.y});
      log('ICON','IP17: trusted pointer drag pans the selected crop',await waitFor(`!!document.querySelector('[data-icon-result]') && document.querySelector('[data-icon-crop] img').style.left!==${JSON.stringify(bounds.left)}`) ? 'PASS':'FAIL');
      const gestureScale = await evalJs(`parseFloat(document.querySelector('[data-icon-crop] img').style.width)`);
      if (driver.isDesktop) {
        await ctx.cdpInput('Input.dispatchMouseEvent',{type:'mouseWheel',x:bounds.x,y:bounds.y,deltaX:0,deltaY:-120});
      } else {
        const points = distance => [
          {id:1,x:bounds.x-distance,y:bounds.y,radiusX:2,radiusY:2,force:1},
          {id:2,x:bounds.x+distance,y:bounds.y,radiusX:2,radiusY:2,force:1},
        ];
        await ctx.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(20)});
        for (let distance=25;distance<=45;distance+=5) {
          await ctx.cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(distance)});
          await sleep(40);
        }
        await ctx.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }
      log('ICON','IP22: real wheel or two-finger pinch zooms the crop',await waitFor(`!!document.querySelector('[data-icon-result]') && parseFloat(document.querySelector('[data-icon-crop] img').style.width)>${gestureScale}`) ? 'PASS':'FAIL');
      await evalJs(`(() => {
        window.__ipCropDecodes=window.__ipDecodes;window.__ipEncodes=0;
        window.__ipNativeToBlob=HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob=function(...args){window.__ipEncodes++;return window.__ipNativeToBlob.apply(this,args)};
        const slider=document.querySelector('[data-icon-zoom]');
        const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
        for(const value of ['200','150','300','250']){set.call(slider,value);slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}))}
        return true;
      })()`);
      const zoomSlider = await waitFor(`document.querySelector('[data-icon-zoom-value]')?.textContent==='250%' && document.querySelector('[data-icon-zoom]')?.value==='250'`);
      log('ICON','IP23: zoom slider updates crop and percentage',zoomSlider && await evalJs(`parseFloat(document.querySelector('[data-icon-crop] img').style.width)===400`) ? 'PASS':'FAIL');
      log('ICON','IP24: crop preview stays mounted and dialog height stays fixed during gestures',await evalJs(`window.__ipCropCanvas===document.querySelector('[data-icon-result]') && Math.abs(document.querySelector('[data-icon-prep]').getBoundingClientRect().height-window.__ipDialogHeight)<1`) ? 'PASS':'FAIL');
      log('ICON','IP25: live crop changes neither decode images nor encode PNGs',await evalJs(`window.__ipDecodes===window.__ipCropDecodes && window.__ipEncodes===0`) ? 'PASS':'FAIL');
      await evalJs(`HTMLCanvasElement.prototype.toBlob=window.__ipNativeToBlob`);
      log('ICON','IP26: lower preview has card size and excluded crop area is dimmed',await evalJs(`(() => {const canvas=document.querySelector('[data-icon-card-preview] canvas');const r=canvas.getBoundingClientRect();return r.width===48 && r.height===48 && document.querySelector('[data-icon-card-preview]').textContent.includes('sound-card size') && !!document.querySelector('[data-icon-crop] [aria-hidden="true"]').style.boxShadow})()`) ? 'PASS':'FAIL');
      await evalJs(`document.querySelector('[data-icon-cancel]').click(); window.__ipUpload()`);
      await waitFor(`!!document.querySelector('[data-icon-mode="original"]:not(:disabled)')`);
      await evalJs(`document.querySelector('[data-icon-mode="original"]').click()`);
      await waitFor(`!!document.querySelector('[data-icon-result]')`);
      const original = await evalJs(`window.__ipPixels('[data-icon-result]')`);
      log('ICON','IP12: use-as-is preview preserves exact original bytes',await evalJs(`JSON.stringify(window.__ipBytes)===${JSON.stringify(JSON.stringify(original?.bytes))}`) ? 'PASS':'FAIL');
      if (!isTauri) {
        await evalJs(`window.__ipSetItem=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){if(k.includes('sound_file_icon_'))throw new Error('Icon write failure probe');return window.__ipSetItem.call(this,k,v)}; document.querySelector('[data-icon-confirm]').click()`);
        const errorShown = await waitFor(`document.querySelector('[data-icon-prep] [role="alert"]')?.textContent.includes('Icon write failure probe')`);
        await evalJs(`Storage.prototype.setItem=window.__ipSetItem`);
        log('ICON','IP13: failed write leaves old editor icon and allows retry',errorShown && await evalJs(`document.querySelector('img[alt="Icon preview"]').getAttribute('src')===window.__ipOriginalIcon && !document.querySelector('[data-icon-confirm]').disabled`) ? 'PASS':'FAIL');
      } else console.log('SKIP ICON IP13: web quota/write injection; native writes exercised by IP14-15');
      await evalJs(`document.querySelector('[data-icon-confirm]').click()`);
      const confirmed = await waitFor(`!document.querySelector('[data-icon-prep]')`);
      const stored = await evalJs(`window.__ipPixels('img[alt="Icon preview"]')`);
      log('ICON','IP14: confirmation stores exact original bytes and marks upload provenance',confirmed && stored?.bytes.join(',')===original?.bytes.join(',') && await evalJs(`document.querySelector('img[alt="Icon preview"]').parentElement.textContent.includes('icon-test.png')`) ? 'PASS':'FAIL');
      if (await submitModal('Save Changes') !== 'OK') throw new Error('Icon fixture could not save the sound.');
      await waitFor(`!document.querySelector('[data-sound-modal-close]')`);
      await reload(); await awaitBoard(ctx, { min: 1 });
      const persisted = await evalJs(`JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')))[0].sounds[0]`);
      log('ICON','IP15: saved icon reference and provenance survive reload',persisted?.icon?.startsWith('icon_') && persisted?.iconDisplayName==='icon-test.png' ? 'PASS':'FAIL');
      // A copied sound shares the original uploaded icon. Replacing one must
      // not remove the sibling's bytes, and closing without Save is reversible.
      await evalJs(`(() => {const key=window.__pk('ttrpg_characters');const chars=JSON.parse(localStorage.getItem(key));chars[0].sounds.push({...chars[0].sounds[0],id:'ip_sibling',name:'Icon Sibling'});localStorage.setItem(key,JSON.stringify(chars));return true})()`);
      await reload(); await awaitBoard(ctx,{min:2});
      await driver.enterEditMode();
      await evalJs(`document.querySelector('[data-sound-id="ip_sound"]').parentElement.querySelector('button[title="Edit Sound"]').click()`);
      await waitFor(`!!document.querySelector('[data-sound-modal-close]')`);
      await evalJs(`window.__ipUpload=${upload};window.__ipPixels=${pixels};window.__ipUpload('crop')`);
      await waitFor(`!!document.querySelector('[data-icon-mode="crop"]:not(:disabled)')`);
      await evalJs(`document.querySelector('[data-icon-mode="crop"]').click()`);
      await waitFor(`!!document.querySelector('[data-icon-result]')`);
      const cropBlob = await evalJs(`window.__ipPixels('[data-icon-result]')`);
      await evalJs(`document.querySelector('[data-icon-confirm]').click()`);
      await waitFor(`!document.querySelector('[data-icon-prep]')`);
      const confirmedCrop = await evalJs(`window.__ipPixels('img[alt="Icon preview"]')`);
      log('ICON','IP18: crop confirmation stores actual 256px PNG result',confirmedCrop?.width===256 && confirmedCrop?.height===256 && confirmedCrop?.bytes.join(',')===cropBlob?.bytes.join(',') ? 'PASS':'FAIL');
      await evalJs(`document.querySelector('[data-sound-modal-close]').click()`);
      await reload(); await awaitBoard(ctx,{min:2});
      log('ICON','IP19: closing outer editor after confirmation preserves saved original',await evalJs(`JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')))[0].sounds[0].icon===${JSON.stringify(persisted.icon)}`) ? 'PASS':'FAIL');
      await driver.enterEditMode();
      await evalJs(`document.querySelector('[data-sound-id="ip_sound"]').parentElement.querySelector('button[title="Edit Sound"]').click()`);
      await waitFor(`!!document.querySelector('[data-sound-modal-close]')`);
      await evalJs(`window.__ipUpload=${upload};window.__ipPixels=${pixels};window.__ipUpload('empty')`);
      await waitFor(`!!document.querySelector('[data-icon-mode="silhouette"]:not(:disabled)')`);
      await evalJs(`document.querySelector('[data-icon-mode="silhouette"]').click()`);
      await waitFor(`!!document.querySelector('[data-icon-result]')`);
      await evalJs(`document.querySelector('[data-icon-confirm]').click()`);
      await waitFor(`!document.querySelector('[data-icon-prep]')`);
      const empty = await evalJs(`window.__ipPixels('img[alt="Icon preview"]')`);
      log('ICON','IP20: empty silhouette can actually be stored',empty?.width===256 && empty?.height===256 && empty?.coverage===0 ? 'PASS':'FAIL');
      if (await submitModal('Save Changes') !== 'OK') throw new Error('Icon replacement could not save the sound.');
      await waitFor(`!document.querySelector('[data-sound-modal-close]')`);
      await reload(); await awaitBoard(ctx,{min:2});
      const shared = await evalJs(`JSON.parse(localStorage.getItem(window.__pk('ttrpg_characters')))[0].sounds`);
      await waitFor(`(() => {const src=document.querySelector('[data-sound-id="ip_sibling"] img')?.src;return !!src && !src.includes('/assets/')})()`);
      const sibling = await evalJs(`${pixels}('[data-sound-id="ip_sibling"] img')`);
      log('ICON','IP21: saving replacement preserves shared original icon bytes',shared?.[0]?.icon!==persisted.icon && shared?.[1]?.icon===persisted.icon && sibling?.bytes.join(',')===original?.bytes.join(',') ? 'PASS':'FAIL');
      await driver.enterEditMode();
      await evalJs(`document.querySelector('[data-sound-id="ip_sound"]').parentElement.querySelector('button[title="Edit Sound"]').click()`);
      await waitFor(`!!document.querySelector('[data-sound-modal-close]')`);
      await evalJs(`(() => {const dt=new DataTransfer();dt.items.add(new File(['broken'],'bad.png',{type:'image/png'}));const input=document.querySelector('input[type="file"][accept*=".svg"]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
      log('ICON','IP16: undecodable upload reports operational error with cancel available',await waitFor(`!!document.querySelector('[data-icon-prep] [role="alert"]') && !!document.querySelector('[data-icon-cancel]:not(:disabled)')`) ? 'PASS':'FAIL');
    } catch (error) {
      log('ICON','IP0: icon preparation suite completed without exception','FAIL',String(error.stack || error));
    } finally {
      await evalJs(`(() => {if(window.__ipSetItem)Storage.prototype.setItem=window.__ipSetItem;if(window.__ipNativeImage)window.Image=window.__ipNativeImage;if(window.__ipNativeToBlob)HTMLCanvasElement.prototype.toBlob=window.__ipNativeToBlob;document.querySelector('[data-icon-cancel]')?.click();document.querySelector('[data-sound-modal-close]')?.click();return true})()`);
    }
  },
};
