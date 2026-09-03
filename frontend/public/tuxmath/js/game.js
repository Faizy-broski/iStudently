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



const LEVEL_CARDS_NUM=40;
const NOT_ANSWERED_REPEAT=2;
const NB_CORRECT_ANSWER_BONUS=10;

class Game
{
  constructor(objJqContainer)
  {
    this.objJqContainer=objJqContainer;
    this.init();
    
    this.running=false;
  }
  
  getObjJqContainer() { return this.objJqContainer; }
  
  init()
  {
    this.tuxConsole=new TuxConsole(this);
    this.keyboardManager=new KeyboardManager();
    this.keyboardManager.fctCallBackKeyStroke.push(this.tuxConsole.updateText.bind(this.tuxConsole));
    this.keyboardManager.fctCallBackKeyStroke.push(this.tuxConsole.evtTyping.bind(this.tuxConsole));
    this.keyboardManager.fctCallBackKeyStroke.push(MusicPlayer.giveUserInputEvent.bind(MusicPlayer));
    this.keyboardManager.fctCallBackEntryValidated.push(this.evtUserValidatedAnswer.bind(this));
    this.keyboardManager.fctCallBackPauseUnpause.push(this.evtPauseUnpause.bind(this));    
  }
  
  evtUserValidatedAnswer(answer)
  {
    if ((this.runningWave) && (this.runningWave.evtUserValidatedAnswer))
    {
      let boolCorrect=this.runningWave.evtUserValidatedAnswer(answer);
      if (boolCorrect) 
        this.totalAnswersGood++;
      else 
      {
        this.totalAnswersBad++;
        this.checkGameOver();
      }
      this.updateCountersDisplay();
    }
  }
  
  startGame(levelId)
  {
    this.running=true;
    this.paused=false;
    this.waveNum=0;
    this.sameLevelWaveNum=0;
    this.totalAnswersGood=0;
    this.totalAnswersBad=0;
    this.nextBonusAt=NB_CORRECT_ANSWER_BONUS;
    
    this.loadLevel(levelId);

    this.startWave();
    
    this.initIgloos();
    MusicPlayer.play();
  }
  
  loadLevel(levelId)
  {
    this.sameLevelWaveNum=0;
    this.levelId=levelId;
    this.mathCardsCollection=new MathCardsCollection();
    this.mathCardsCollection.genCards(this.levelId, LEVEL_CARDS_NUM);
  }
  
  getWaveComets(waveNum)
  {
    return(4+waveNum);
  }
  
  
  startWave()
  {
    this.waveNum++;
    this.sameLevelWaveNum++;
    this.objJqContainer.find(".js-background").css("background-image", "url('"+tmGlob_objTheme.chooseBackground()+"')");
    
    let waveCards=this.mathCardsCollection.takeCards(this.getWaveComets(this.sameLevelWaveNum));
    
    if (waveCards.length==0)
    {
      this.gameFinished(true);
      return false;
    }
    
    this.runningWave=new GameWave(this, waveCards);
    
    this.updateCountersDisplay();
    
    //Launching programming wave start animation events
    let startOffset=0;
    if (this.waveNum>1) startOffset=2000;
    
    setTimeout(this.tuxConsole.setTuxImage.bind(this.tuxConsole, CONSOLE_TUX_PRESTART), 100); //overridden if called directly, override check not simple to implement...
    setTimeout(function(){
      tmGlob_objSfxPlayer.playSfx(SFX_LEVELSTART)
      this.tuxConsole.yellowBlink();
    }.bind(this), startOffset+2000);
    setTimeout(function(){
      this.tuxConsole.setTuxImage(CONSOLE_TUX_ANIMSTART);
    }.bind(this), startOffset+3000);    
    

    setTimeout(this.runningWave.startWave.bind(this.runningWave), startOffset+4000);
    
  }
  
  initIgloos()
  {
    this.arIgloos=[]
    for (let i=1; i<=GAME_COLUMNS_NUMBER; i++)
      this.arIgloos.push(new Igloo(this, i));
  }
  
  //get random alive igloo
  getAliveIgloo()
  {
    let rndMap=[];
    for (let i in this.arIgloos)
      rndMap[i]=i;
    array_shuffle(rndMap);
    
    for (let i in this.arIgloos)
      if (! this.arIgloos[rndMap[i]].isDestroyed())
        return  this.arIgloos[rndMap[i]];
  }
  

  pause()
  {
    this.paused=true;
    $("body").addClass("gamePaused");
    MusicPlayer.pause();
  }

  unPause()
  {
    this.paused=false;
    $("body").removeClass("gamePaused");
    MusicPlayer.unPause();
  }
  
  evtPauseUnpause()
  {
    if (this.paused) this.unPause();
    else this.pause();
  }
  
  ispaused() { return this.paused; }
  
  gameFinished(boolSuccess)
  {
    this.running=false;
    this.cleanUp();
    
    if (boolSuccess)
    {
      gold_star_add(this.levelId);
      new MessageGameEnd(GAME_END_WIN, this.keyboardManager);
      for (let i in this.arIgloos)
        this.arIgloos[i].evtWin();
    }
    else
      new MessageGameEnd(GAME_END_LOOSE, this.keyboardManager);
  }
  
  evtNotAnswered(cometId, mathCard, colNumber) //comet reached bottom and exploded...
  {
    this.arIgloos[colNumber-1].evtGotHit();
    this.tuxConsole.setTuxImage(CONSOLE_TUX_IGLOODESTROYED);
    this.checkGameOver();
    this.mathCardsCollection.addMathCard(mathCard, NOT_ANSWERED_REPEAT);
    
    this.runningWave.evtNotAnswered(cometId, mathCard, colNumber);
    
    this.updateCountersDisplay();
  }
  
  cleanUp()
  {
    this.runningWave.cleanUp();
  }
  
  checkGameOver()
  {
    let gameOver=true;
    
    for (let i in this.arIgloos)
      if (! this.arIgloos[i].isDestroyed())
        gameOver=false;
      
    if (gameOver)
      this.gameFinished(false);
        
  }
  
  evtWaveFinished()
  {
    if (tmGlob_Options.get(OPT_AUTOLEVEL)=="1")
    {
      let computedLJ=this.runningWave.computeLevelJump();
      if (computedLJ!=AL_NOJUMP)
      {
        if (computedLJ<AL_JUMP_FORWARD_SMALL) new Toast(tmGlob_Lang.getitem("message_al_toast_jumpbackward"), TOAST_ICON_AUTOLEVEL);
        else new Toast(tmGlob_Lang.getitem("message_al_toast_jumpforward"), TOAST_ICON_AUTOLEVEL);

        let newLevelId=tmGlob_levelJumps[this.levelId][computedLJ];
        console.log(computedLJ, "= jump from", this.levelId, "to", newLevelId);
        if (newLevelId!=this.levelId) //prevent reloading if new and old levels are the same...
          this.loadLevel(newLevelId);
      }
    }
    
    if (this.running)
      this.startWave();
  }
  
  updateCountersDisplay()
  {
    let objJqCounters=this.objJqContainer.find(".layout-game__overlay");
    objJqCounters.find(".js-level").text(this.waveNum);
    
    let cometsLeft=this.mathCardsCollection.getSize()+this.runningWave.getRemainingComets();
    objJqCounters.find(".js-cometsleft").text(cometsLeft);
    objJqCounters.find(".js-anwsers-goods").text(this.totalAnswersGood);
    objJqCounters.find(".js-anwsers-wrongs").text(this.totalAnswersBad);
  }
  
  nextCometIsBonus()
  {
    if (this.totalAnswersGood>this.nextBonusAt)
    {
      this.nextBonusAt=this.totalAnswersGood+NB_CORRECT_ANSWER_BONUS;
      return true;
    }
    else return false;
  }
  
  evtBonusCometDestroyed()
  {
    let mostDestroyedId=-1;
    let mostDestroyedHealth=IGLOO_HEALTH_OK;
    
    for (let i in this.arIgloos)
      if (this.arIgloos[i].health<mostDestroyedHealth)
      {
        mostDestroyedId=i;
        mostDestroyedHealth=this.arIgloos[i].health;
      }
    
    if (mostDestroyedHealth<IGLOO_HEALTH_OK)
      this.arIgloos[mostDestroyedId].repair();
  }
}





const GAMEWAVE_ADDCOMET_DELAY=6000;
//const GAMEWAVE_ADDCOMET_DELAY=1000; //DEBUG HACK
const FALSE_LOCATION_SEARCH_TRIES=4;
const FALSE_LOCATION_SEARCH_MAXCOMETDISTANCEALLOWED=65;
const NB_ANSWER_BAD_DESTROY_IGLOO=6;

const AUTOLEVEL_MEAN_ANWSER_TIME_FORWARD_SMALL=13; //was 16 in C verison
const AUTOLEVEL_MEAN_ANWSER_TIME_FORWARD_BIG=6; //was 8 in C verison

class GameWave
{
  constructor(objGame, arMathCards)
  {
    this.objGame=objGame;
    this.arMathCardsToLaunch=arMathCards;
    this.arLaunchedCommets=[];
    this.answersGood=0;
    this.answersBad=0;
    this.answersNotAnswered=0;
    this.answersGoodTimes=[];
  }
  
  startWave()
  {
    this.objIntervalLaunchComet=setInterval(this.evtIntervLaunchComet.bind(this), GAMEWAVE_ADDCOMET_DELAY);
    this.evtIntervLaunchComet(); //don't wait for launching first comet
  }
  
  launchComet()
  {
    let mathCard=this.arMathCardsToLaunch.shift();
    this.arLaunchedCommets.push(new Comet(this.objGame, mathCard));
  }
  
  evtIntervLaunchComet()
  {
    if (this.objGame.ispaused()) return;
    
    if (this.arMathCardsToLaunch.length==0)
    {
      clearInterval(this.objIntervalLaunchComet);
      return false;
    }
    
    this.launchComet();
  }
  
  evtNotAnswered(cometId, mathCard, colNumber) //comet reached bottom and exploded...
  {
    this.answersNotAnswered++;
    this.removeComet(cometId);
    this.checkWaveFinished();
  }
  
  computeLevelJump()
  {
    let meanSecondsAnswersGoodTime=this.answersGoodTimes.reduce((a,b) => a + b, 0) / this.answersGoodTimes.length;
    
    console.log({ "answGood": this.answersGood, "answBad": this.answersBad, "meanTime": meanSecondsAnswersGoodTime, "unanswered": this.answersNotAnswered });
    
    if ((this.answersNotAnswered*2>=this.answersGood*3) && (this.answersNotAnswered>2))
      return AL_JUMP_BACKWARD_BIG;

    if ((this.answersNotAnswered>=this.answersGood) && (this.answersNotAnswered>1))
      return AL_JUMP_BACKWARD_SMALL;

    if ((meanSecondsAnswersGoodTime<AUTOLEVEL_MEAN_ANWSER_TIME_FORWARD_BIG) && (this.answersBad<this.answersGood))
      return AL_JUMP_FORWARD_BIG;
  
    if ((meanSecondsAnswersGoodTime<AUTOLEVEL_MEAN_ANWSER_TIME_FORWARD_SMALL) && (this.answersBad<this.answersGood))
      return AL_JUMP_FORWARD_SMALL;
    
    return AL_NOJUMP;
  }
  
  evtUserValidatedAnswer(answer)
  {
    let cometsMatched=0;
    for (let i=this.arLaunchedCommets.length-1; i>=0; i--) //process array reverse order, to prevent index skip bugs
      if (this.arLaunchedCommets[i].answer==answer)
      {
        cometsMatched++;
        this.answersGoodTimes.push(this.arLaunchedCommets[i].getSecondsSinceLaunch());
        this.arLaunchedCommets[i].destroy();
        new Laser(this.objGame, this.arLaunchedCommets[i]);
        this.removeComet(this.arLaunchedCommets[i].getId()); //remove at end of iteration!
      }
      
    if (cometsMatched>1)
      tmGlob_objSfxPlayer.playSfx(SFX_COMETDESTROY_MULTIPLE);

    if (cometsMatched>0)
    {
      this.answersGood++;
      this.checkWaveFinished();
    }
    else
    {
      this.answersBad++;
      tmGlob_objSfxPlayer.playSfx(SFX_ANSWER_BAD);
      this.objGame.tuxConsole.redBlink();
      
      if (this.answersBad%NB_ANSWER_BAD_DESTROY_IGLOO==0)
      { //to many bad anwser -> Destroy igloo
        let targetIgloo=this.objGame.getAliveIgloo();
        new Laser(this.objGame, targetIgloo.getCenterCoords());
        targetIgloo.evtGotHitByLaser();
      }
      else
      {
        new Laser(this.objGame, this.searchFalseLocation());
      }
    }
    
    return (cometsMatched>0); //return true if user writen validen answer, false otherwise.
  }
  
  searchFalseLocation()
  {
    let originJqObject=this.objGame.getObjJqContainer().find(".js-laser-origin");
    let br=originJqObject[0].getBoundingClientRect();
    let originCoords=[Math.round(br.x+br.width/2), Math.round(br.y+br.height/2)];
    let origLaserObj={x: originCoords[0], y: originCoords[1]};

    
    tryLoop: for (let triesLeft=FALSE_LOCATION_SEARCH_TRIES; triesLeft>0; triesLeft--)
    {
      //let targetCoords=[getRandomInt(0, this.objGame.getObjJqContainer().width()-1), getRandomInt(0,this.objGame.getObjJqContainer().height()*.8-1)]; //*.8 to prevent laser going down
      //target random plot of screen is not good, we shoud olny target borders
      
      let border=getRandomInt(0, 2);
      let targetCoords;
      if (border==0) targetCoords=[0, getRandomInt(0,this.objGame.getObjJqContainer().height()*.8-1)];
      if (border==1) targetCoords=[getRandomInt(0,this.objGame.getObjJqContainer().width()-1), 0];
      if (border==2) targetCoords=[this.objGame.getObjJqContainer().width(), getRandomInt(0,this.objGame.getObjJqContainer().height()*.8-1)];
      
      let targetLaserObj={x: targetCoords[0], y: targetCoords[1]};
      
      for (let i in this.arLaunchedCommets)
      {
        let commetCoords=this.arLaunchedCommets[i].getCenterCoords();
        let objCommetCoords={x: commetCoords[0], y: commetCoords[1]};
        
        if (distToSegment(objCommetCoords, origLaserObj, targetLaserObj)<FALSE_LOCATION_SEARCH_MAXCOMETDISTANCEALLOWED)
          continue tryLoop;
      }
      
      //continue not called, the point is correct
      return targetCoords;
    }
    
    //tries exhausted, firing vertical
    return [Math.round(this.objGame.getObjJqContainer().width()/2), 0];
  }
  
  removeComet(cometId)
  {
    for (let i in this.arLaunchedCommets)
      if (this.arLaunchedCommets[i].getId()==cometId)
        this.arLaunchedCommets.splice(i, 1);
  }
  
  cleanUp()
  {
    clearInterval(this.objIntervalLaunchComet);
    
    for (let i in this.arLaunchedCommets)
      this.arLaunchedCommets[i].cleanUp();
  }
  
  checkWaveFinished()
  {
    if ((this.arLaunchedCommets.length==0)  && (this.arMathCardsToLaunch.length==0))
      this.objGame.evtWaveFinished();
  }
  
  getRemainingComets()
  {
    return this.arLaunchedCommets.length+this.arMathCardsToLaunch.length;
  }

}

