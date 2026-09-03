
const KEYCODE_BACKSPACE=8;
const KEYCODE_TAB=9;
const KEYCODE_ENTER=13;
const KEYCODE_ESCAPE=27;
const KEYCODE_SPACE=32;
const KEYCODE_DELETE=46;

const KEYCODE_0=48;
const KEYCODE_1=49;
const KEYCODE_2=50;
const KEYCODE_3=51;
const KEYCODE_4=52;
const KEYCODE_5=53;
const KEYCODE_6=54;
const KEYCODE_7=55;
const KEYCODE_8=56;
const KEYCODE_9=57;

const KEYCODE_NUMPAD_0=96;
const KEYCODE_NUMPAD_1=97;
const KEYCODE_NUMPAD_2=98;
const KEYCODE_NUMPAD_3=99;
const KEYCODE_NUMPAD_4=100;
const KEYCODE_NUMPAD_5=101;
const KEYCODE_NUMPAD_6=102;
const KEYCODE_NUMPAD_7=103;
const KEYCODE_NUMPAD_8=104;
const KEYCODE_NUMPAD_9=105;

const KEYCODE_MULTIPLY=106;
const KEYCODE_ADD=107;
const KEYCODE_SUBTRACT=109;
const KEYCODE_DECIMAL_POINT=110;
const KEYCODE_DIVIDE=111;

const KEYPAD_LENMAX=4;

class KeyboardManager
{
  constructor()
  {
    this.fctCallBackKeyStroke=[];
    this.fctCallBackEntryValidated=[];
    this.fctCallBackPauseUnpause=[];
    this.fctCallBackExit=[];
    
    this.init();
  }
  
  init()
  {
    this.typedContent="";
    $("body").bind("keydown", this.evtKeyDown.bind(this));
    $(".js-osk").bind("click", this.evtOskClick.bind(this));
    this.negative=false;
  }
  
  evtInputNum(num)
  {
    if (this.typedContent.length<KEYPAD_LENMAX)
    {
      this.typedContent+=num.toString();
      this.callCallBackKeyStroke();
    }
    //TODO: gestion des cas oyu l'utilisateur dépasse le tampon
  }
  
  typedString()
  {
    let retContent=this.typedContent;
    if (retContent=="") retContent=0;
    
    if (this.negative) retContent="-"+retContent;
    
    return(retContent);
  }
  
  evtInputValidated()
  {
    for(let i in this.fctCallBackEntryValidated)
      this.fctCallBackEntryValidated[i](this.typedString());
    this.evtDelete();
  }
  
  evtReverseSign()
  {
    this.negative=!this.negative;
    this.callCallBackKeyStroke();
  }
  
  callCallBackKeyStroke()
  {
    for(let i in this.fctCallBackKeyStroke)
    this.fctCallBackKeyStroke[i](this.typedString());
  }
  
  evtDelete()
  {
    this.typedContent="";
    this.negative=false;
    this.callCallBackKeyStroke();
  }

  evtPauseUnpause()
  {
    for (let i in this.fctCallBackPauseUnpause)
      this.fctCallBackPauseUnpause[i]();
  }
  
  processKey(kc)
  {
    let catched=true;
    if ((kc>=KEYCODE_0) && (kc<=KEYCODE_9)) this.evtInputNum(kc-KEYCODE_0);
    else if ((kc>=KEYCODE_NUMPAD_0) && (kc<=KEYCODE_NUMPAD_9)) this.evtInputNum(kc-KEYCODE_NUMPAD_0);
    else if ((kc==KEYCODE_ENTER) || (kc==KEYCODE_SPACE)) this.evtInputValidated();
    else if (kc==KEYCODE_SUBTRACT) this.evtReverseSign();
    else if ((kc==KEYCODE_BACKSPACE) || (kc==KEYCODE_DELETE)) this.evtDelete();
    else if (kc==KEYCODE_TAB) this.evtPauseUnpause();
    else catched=false;
    
    return (catched)
  }
  
  evtKeyDown(event)
  {
    let kc=event.keyCode;
    let catched=this.processKey(kc);
    if(catched)
      event.preventDefault();
  }
  
  evtOskClick(event)
  {
    let kc=$(event.target).attr("data-osk-kcode");
    if(typeof kc!=undefined)
      this.processKey(kc)
    event.preventDefault();
  }
}
