const OPT_LANG="opt_lang";
const OPT_THEME="opt_theme";
const OPT_AUTOLEVEL="opt_autolevel";
const OPT_OSK="opt_osk";
const OPT_SFX="opt_sfx";
const OPT_MUSIC="opt_music";

const OPTIONS_LIST=[OPT_LANG, OPT_THEME, OPT_AUTOLEVEL, OPT_OSK, OPT_SFX, OPT_MUSIC];

class TmOptions
{
  constructor()
  {
    this.options={};
    
    this.loadDefaults();
    this.loadCookies();
    this.processHttpOptions();
  }
  
  loadDefaults()
  {
    this.options[OPT_LANG]=false; //if OPT_LANG is false, Lang class will detect drowser language
    this.options[OPT_THEME]="classic";
    this.options[OPT_AUTOLEVEL]="0";
    this.options[OPT_OSK]="1";
    this.options[OPT_SFX]="1";
    this.options[OPT_MUSIC]="1";
  }
  
  loadCookies()
  {
    if (typeof CookiesStoreInterface != "undefined") //android app
    {
      for (let j in OPTIONS_LIST)
        if (CookiesStoreInterface.have(OPTIONS_LIST[j]))
          this.options[OPTIONS_LIST[j]]=CookiesStoreInterface.get(OPTIONS_LIST[j]);
     }
    else //on web
    {
      let cooksArray=document.cookie.split("; ");
      
      for (let i in cooksArray)
      {
        let prm, val;
        [prm, val]=cooksArray[i].split("=");
        
        for (let j in OPTIONS_LIST)
          if (OPTIONS_LIST[j]==prm) this.options[OPTIONS_LIST[j]]=val;
      }
    }
  }
  
  processHttpOptions()
  {
    const urlParams = new URLSearchParams(window.location.search);
    
    for (let i in OPTIONS_LIST)
      if (urlParams.has(OPTIONS_LIST[i]))
        this.setOption([OPTIONS_LIST[i]], urlParams.get(OPTIONS_LIST[i]));
  }
  
  setOption(prm, val)
  {
    this.options[prm]=val;
    setCookie(prm, val);
  }
  
  get(prm)
  {
    return this.options[prm];
  }
}




class TmOptionsMenu
{
  constructor()
  {
    this.createListeners();
    this.initRadioSelections();
  }
  
  createListeners()
  {
    $("input[type=radio][name^=opt_]").click(this.evtclickRadio.bind(this));
  }
  
  evtclickRadio(evt, boolFiredInternaly)
  {
    if ((typeof boolFiredInternaly) && (boolFiredInternaly===true))
      return;
    tmGlob_Options.setOption(evt.target.name, evt.target.value);
  }
  
  initRadioSelections()
  {
    for (let i in OPTIONS_LIST)
    {
      let val=tmGlob_Options.get(OPTIONS_LIST[i]);
      $("input[type=radio][name='"+OPTIONS_LIST[i]+"'][value='"+val+"']").trigger("click", true);
    }
  }
}
