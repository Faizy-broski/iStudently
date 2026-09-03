// TuxMath JS
//
// Author: Julien Marin - projet Afrikalan  
// Contact: julien.marin@afrikalan.org
// Licence: AGPL-3.0-or-later, see COPYING file

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
// 
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.



function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max+1-min))+min;
}

function getRandomArrayElt(ar)
{
  let idx=getRandomInt(0, ar.length-1);
  return ar[idx];
}



//From: https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
function sqr(x) { return x * x }
function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
function distToSegmentSquared(p, v, w) {
  var l2 = dist2(v, w);
  if (l2 == 0) return dist2(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x),
                    y: v.y + t * (w.y - v.y) });
}
function distToSegment(p, v, w) { return Math.sqrt(distToSegmentSquared(p, v, w)); }

function detectMobile()
{
  let check=false;
  (function(a,b){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check=true;})(navigator.userAgent||navigator.vendor||window.opera); //from 'http://detectmobilebrowser.com'
  return check
}

function requestFullScreen() {
    var element=document.body;
  
    // Supports most browsers and their versions.
    var requestMethod = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || element.msRequestFullScreen;

    if (requestMethod) { // Native full screen.
        requestMethod.call(element);
    } else if (typeof window.ActiveXObject !== "undefined") { // Older IE.
        var wscript = new ActiveXObject("WScript.Shell");
        if (wscript !== null) {
            wscript.SendKeys("{F11}");
        }
    }

}

function array_shuffle(array) //took from https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  {
    let currentIndex = array.length,  randomIndex;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  }
  
  
function getCookie(cookieName, defaultVal=false)
{
  if (typeof CookiesStoreInterface != "undefined") //android app
  {
    if (CookiesStoreInterface.have(cookieName))
      return CookiesStoreInterface.get(cookieName);
  }
  else //on web
  {
    let cooksArray=document.cookie.split("; ");
    
    for (let i in cooksArray)
    {
      let prm, val;
      [prm, val]=cooksArray[i].split("=");
      
      if (prm==cookieName) return val;
    }
  }
  
  //nothing Found
  return defaultVal;
}

function setCookie(cookieName, cookieVal)  
{
  if (typeof CookiesStoreInterface != "undefined") //android app
  {
      CookiesStoreInterface.set(cookieName, cookieVal);
  }
  else
  {
    let expDays=3650; // ~10 years
    let expDate = new Date();
    expDate.setTime(expDate.getTime() + (expDays*24*60*60*1000));
    document.cookie = cookieName + "=" + cookieVal + "; expires=" + expDate.toUTCString()+"; SameSite=lax";
  }
}
  
  
  
//
// Gold star management
// ---------------------
//
// Here beaucause i wouldn't create a separate file just for this



function gold_star_add(lvlId)
{
  let arrGS;
  let gsCookie=getCookie("tm_goldstars");
  if (gsCookie!==false) arrGS=gsCookie.split(",");
  else arrGS=[];
  
  if (arrGS.indexOf(arrGS)==-1)
    arrGS.push(lvlId);
  
  arrGS.sort();
  
  setCookie("tm_goldstars", arrGS.join(","));
}


class FullscreenSwitcher
{
  constructor(objJq)
  {
    this.objJq=objJq;
    this.expanded=false;
    this.objJq.click(this.evtswitch.bind(this));
  }
  
  evtswitch()
  {
    this.expanded=!this.expanded;
    if (this.expanded)
    {
      if (typeof window.requestFullScreen!="undefined")
        window.requestFullScreen();
      this.objJq.find(".js-icon-fs-on").show();
      this.objJq.find(".js-icon-fs-off").hide();
    }
    else
    {
      if (typeof document.exitFullscreen!="undefined")
        document.exitFullscreen();
      this.objJq.find(".js-icon-fs-on").hide();
      this.objJq.find(".js-icon-fs-off").show();
    }
  }
}

//handle click on the "back" button (in game).
//NB: this function needs acces top Toast class and tmGlob_Lang variable
const SECOND_CLICK_EXIT_DELAY_MS=5000;
function handleBackClickEvt(evt)
{
  if (typeof handleBackClickEvt.lastClickTs=="undefined") handleBackClickEvt.lastClickTs=0;
  if (typeof handleBackClickEvt.mobileDetected=="undefined") handleBackClickEvt.mobileDetected=false;
  
  if (evt.type=='touchend') 
  { 
    handleBackClickEvt.mobileDetected=true;
    return ;
  }
  
  if (! handleBackClickEvt.mobileDetected)
    history.back(); //event triggered by mouse, no risk of error, exit immediately
  else //event triggered by touch, ask confiration by second touch before exit.
  {
    let thisClickTs=new Date();
    if (thisClickTs-handleBackClickEvt.lastClickTs < SECOND_CLICK_EXIT_DELAY_MS)
      history.back();
    else
      new Toast(tmGlob_Lang.getitem("message_toast_clickagainexit"));
  
    handleBackClickEvt.lastClickTs=thisClickTs;
  }
}
