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

const MATHCARD_QUESTION_LOC_ANSWER=-1;

class MathCard
{
  constructor()
  {
    //this.questionText="";
    this.answer=false;
    
    this.operands=[];
    this.operators=[];
    this.questionLocation=MATHCARD_QUESTION_LOC_ANSWER;
  }
  
  getNumOperators()
  {
    return this.operators.length;
  }

  calcResult()
  {
    let calcString=this.formatNegNumStr(this.operands[0]); //Formated negstrings needed, else "--" will cause erros
    
    for (let i = 0; i < this.operators.length; i++) 
    {
      calcString+=this.operators[i];
      calcString+=this.formatNegNumStr(this.operands[i+1]);
    }
    
    return eval(calcString);
  }
  
  formatNegNumStr(num)
  {
    if (num>=0) 
      return num.toString();
    else 
      return "("+num.toString()+")";
  }
  
  questionText(withResponse=false)
  {
    let genString;
    let txtOperator;
    
    if ((this.questionLocation!=0) || (withResponse))
      genString=this.formatNegNumStr(this.operands[0]);
    else 
      genString="?";

    for (let i = 0; i < this.operators.length; i++) 
    {
      txtOperator=this.operators[i];
      if (txtOperator=="*") txtOperator="x";
      if (txtOperator=="/") txtOperator="÷";
      genString+=txtOperator;
      
      if ((this.questionLocation!=i+1) || (withResponse))
        genString+=this.formatNegNumStr(this.operands[i+1]);
      else 
        genString+="?";
    }

    genString+="=";
    if ((this.questionLocation==MATHCARD_QUESTION_LOC_ANSWER) && (!withResponse))
      genString+="?";
    else
      genString+=this.calcResult().toString();
    
    return genString;
  }
  
  getPossibleAnswer()
  {
    if (this.questionLocation==MATHCARD_QUESTION_LOC_ANSWER)
      return this.calcResult();
    else
      return this.operands[this.questionLocation];
  }

  isValid()
  {
    let result=this.calcResult();
    
    if (isNaN(result))
      return false;
    
    if ((this.questionLocation!=MATHCARD_QUESTION_LOC_ANSWER)) //check that there is not multiply by zero if answer is zero to avoid situations like 0 x ? = 0 that admite infinite solutions...
    {
      for(let i=this.questionLocation; i<this.operators.length && this.operators[i]=="*"; i++)
        if (this.operands[i+1]=="0") return false;
      for(let i=this.questionLocation; i>0 && this.operators[i-1]=="*"; i--)
        if (this.operands[i-1]=="0") return false;
    }
      
    return true
  }
}


class MathsCardsGenerator
{
  constructor()
  {
    this.genSettings=false;
  }
  
  loadGenSettings(settings)
  {
    this.genSettings=$.extend({}, this.defaultGenSettings(), settings);
  }
  
  defaultGenSettings()
  {
    return {
      "oper": ["add", "sub"],
      "oper_mix_allowed": true,
      
      "first_operand_min": 0,
      "first_operand_max": 10,
      "add_addend_min": 1,
      "add_addend_max": 10,
      "add_result_max": false,
      "sub_subtrahend_min": 0,
      "sub_subtrahend_max": 10,
      "sub_negative_result_allowed": false,
      "mul_multiplacand_min": 1,
      "mul_multiplacand_max": 10,
      "mul_multiplacand_zeroallowed": true,
      "div_dividand_min": 0,
      "div_dividand_max": 100,
      "div_divisor_min": 1,
      "div_divisor_max": 10,
      "div_result_min": -10,
      "div_result_max": 10,
      "min_operators" : 1,
      "max_operators" : 1,
      
      "allowed_question_location" : [MATHCARD_QUESTION_LOC_ANSWER]
    };
  }
  

  checkGenParams()
  {
    if ((this.genSettings.oper.indexOf("div")!=-1) && (this.genSettings.max_operators>1) && (this.genSettings.oper.length==1))
    {
      throw "many chained division are note possible for now on...";
    }
    
    if ((this.genSettings.div_divisor_min==0) && (this.genSettings.div_divisor_max==0))
      throw "can't force divisor to be zero!";
    
    if ((! this.genSettings.sub_negative_result_allowed) && (this.genSettings.oper.indexOf("sub")!=-1) && ( (this.genSettings.oper.indexOf("mul")!=-1) || (this.genSettings.oper.indexOf("div")!=-1) ) )
    {
      throw "sub_negative_result_allowed can't be correcctly enforced when sub mixed with higher priority ops like mul or div.";
    }

    if ((this.genSettings.add_result_max!==false) && (this.genSettings.oper.indexOf("add")!=-1) && ( (this.genSettings.oper.indexOf("mul")!=-1) || (this.genSettings.oper.indexOf("div")!=-1) ) )
    {
      throw "add_result_max can't be correcctly enforced when sub mixed with higher priority ops like mul or div.";
    }

    
    if ((this.genSettings.oper.indexOf("div")!=-1) &&  (this.genSettings.max_operators>1) && (! this.genSettings.oper_mix_allowed))
    {
      throw "many chained division are note possible for now on... but you asked more than one operator without allowing mixing of operation types";
    }
    
  }
  
  genCard()
  {
    let actOperator;
    
    let targetedNumOperators=getRandomInt(this.genSettings.min_operators, this.genSettings.max_operators);
    
    let mathcard=new MathCard();
    
    this.checkGenParams();
    
    mathcard.questionLocation=getRandomArrayElt(this.genSettings.allowed_question_location);
    
    while (mathcard.getNumOperators()<targetedNumOperators)
    {
      if (mathcard.getNumOperators()==0)
      {
        mathcard.operands.push(getRandomInt(this.genSettings.first_operand_min, this.genSettings.first_operand_max));
        actOperator=getRandomArrayElt(this.genSettings.oper);
      }
      else
      {
        if (this.genSettings.oper_mix_allowed) //next rounds, oper type will change only if oper_mix_allowed is true.
          actOperator=getRandomArrayElt(this.genSettings.oper);
      }
      
      switch(actOperator)
      {
        case "add":
          let max_addend=(this.genSettings.add_result_max!==false)?this.genSettings.add_result_max-mathcard.calcResult():this.genSettings.add_addend_max;
          mathcard.operands.push(getRandomInt(this.genSettings.add_addend_min, max_addend));
          mathcard.operators.push("+");
        break;
        case "sub":
          let max_subtrahend=(this.genSettings.sub_negative_result_allowed===false)?Math.min(this.genSettings.sub_subtrahend_max, mathcard.calcResult()):this.genSettings.sub_subtrahend_max;
          mathcard.operands.push(getRandomInt(this.genSettings.sub_subtrahend_min, max_subtrahend));
          mathcard.operators.push("-");
        break;
        case "mul":
          let multiplicand=getRandomInt(this.genSettings.mul_multiplacand_min, this.genSettings.mul_multiplacand_max);
          if ((multiplicand==0) && (!this.genSettings.mul_multiplacand_zeroallowed))
            multiplicand=getRandomInt(1, this.genSettings.mul_multiplacand_max);
          mathcard.operands.push(multiplicand);
          mathcard.operators.push("*");
        break;
        case "div":
          if (mathcard.operators.length>0) continue; //can't handle cases where division is not in first place
          let divisor=getRandomInt(this.genSettings.div_divisor_min, this.genSettings.div_divisor_max);
          //if (divisor==0) continue; //checked by Mathcard.isvalid()
          let minResult=Math.ceil(this.genSettings.div_dividand_min/divisor);
          let maxResult=Math.floor(this.genSettings.div_dividand_max/divisor);
          minResult=Math.max(minResult, this.genSettings.div_result_min);
          minResult=Math.min(minResult, this.genSettings.div_result_max);
          maxResult=Math.max(maxResult, this.genSettings.div_result_min);
          maxResult=Math.min(maxResult, this.genSettings.div_result_max);
          let result=getRandomInt(minResult, maxResult);
          mathcard.operands[0]=result*divisor;
          mathcard.operands[1]=divisor;
          mathcard.operators[0]='/';
          //only 
        break;
        default:
          throw "unknown operator type: "+actOperator;
      }
    }
    
    return mathcard;
  }
  

}

class MathCardsCollection
{
  constructor()
  {
    this.arCards=[];
  }
  
  genCards(lvlId, num)
  {
    let cardGenerator=new MathsCardsGenerator();
    cardGenerator.loadGenSettings(tmGlob_levelsSettings[lvlId]);
    
    for (let i=0; i<num; i++)
    {
      let card=cardGenerator.genCard()
      if (card.isValid())
        this.arCards.push(card);
      //else console.log("carte refusée: ", card.questionText(), card.questionText(true), card);
    }
  }
  
  addMathCard(mathCard, copies)
  {
    for (let i=0; i<copies; i++)
      this.arCards.push(mathCard);
    
    if (copies>0)
      array_shuffle(this.arCards);
  }
  
  takeCards(num)
  {
    return this.arCards.splice(0, num);
  }
  
  getSize()
  {
    return this.arCards.length;
  }
  
  dump()
  {
    for (let i in this.arCards)
      console.log(this.arCards[i].questionText(), this.arCards[i].getPossibleAnswer())
  }
}
