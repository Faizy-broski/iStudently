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


let tmGlob_levelsGroups={ //keep this header unchanged for python proccess it
  "sum": ["add_1_to_3", "add_0_to_5", "add_sum_to_10", "add_sum_to_15", "add_sum_to_20", "add_3_terms_0_10", "add_3_terms_0_20", "add_2_digits", "add_miss_num", "add_up_to_5_terms", "add_3_digits", "add_harder"],
  "sub": ["sub_0_to_5", "sub_0_to_10", "sub_0_to_20_10", "sub_0_to_20_20", "mix_add_sum_0_20", "sub_miss_num", "sub_3_terms_0_10", "mix_add_sum_0_15_3_terms", "mix_add_sum_0_15_up_to_5_terms", "sub_2_digits", "sub_3_digits", "sub_harder"],
  "mul": ["mul_table_2", "mul_table_3", "mul_table_4", "mul_table_5", "mul_table_1_to_5", "mul_table_6", "mul_table_7", "mul_table_0_to_7", "mul_table_8", "mul_table_9", "mul_table_10", "mul_table_0_to_10", "mul_table_2_3_miss_num", "mul_table_4_5_miss_num", "mul_table_6_7_miss_num", "mul_table_8_9_miss_num", "mul_table_0_to_10_miss_num", "mul_table_11_to_12", "mul_table_13_to_15"],
  "div": ["div_by_2", "div_by_3", "div_by_4", "div_by_5", "div_by_1_to_5", "div_by_6", "div_by_7", "div_by_8", "div_by_9", "div_by_10", "div_by_1_to_10", "mix_div_mul", "div_by_1_to_10_missnum", "div_by_11_to_12", "div_by_13_to_15"],
  "relatives": ["sub_0_to_20_negresults", "add_0_to_10_relatives", "add_0_to_20_relatives", "sub_0_to_10_relatives", "sub_0_to_20_relatives", "mix_add_sub_relatives_3_terms", "mix_add_sub_relatives_up_to_5_terms", "mul_table_0_to_10_relatives", "div_by_1_to_10_relatives", "mix_mul_div_relatives_up_to_4_terms"]
};//END_tmGlob_levelsGroups leave this so python can detect/extract data.


let tmGlob_levelsSettings={ //keep this header unchanged for python proccess it
  //
  // Additions
  //
  "add_1_to_3":  { //lesson01
    "oper": ["add"],
    "first_operand_min": 1,
    "first_operand_max": 3,
    "add_addend_min": 1,
    "add_addend_max": 3
  },
  "add_0_to_5":  { //lesson02
    "oper": ["add"],
    "first_operand_min": 0,
    "first_operand_max": 5,
    "add_addend_min": 0,
    "add_addend_max": 5
  },
  "add_sum_to_10":  { //lesson03
    "oper": ["add"],
    "first_operand_min": 1,
    "first_operand_max": 9,
    "add_addend_min": 0,
    "add_addend_max": 9,
    "add_result_max": 10
  },
  "add_sum_to_15":  { //lesson04
    "oper": ["add"],
    "first_operand_min": 1,
    "first_operand_max": 14,
    "add_addend_min": 1,
    "add_addend_max": 9,
    "add_result_max": 15
  },
  "add_sum_to_20":  { //lesson05
    "oper": ["add"],
    "first_operand_min": 1,
    "first_operand_max": 19,
    "add_addend_min": 1,
    "add_addend_max": 12,
    "add_result_max": 20    
  },
  "add_2_digits":  { //lesson06
    "oper": ["add"],
    "first_operand_min": 1,
    "first_operand_max": 70,
    "add_addend_min": 1,
    "add_addend_max": 80,
    "add_result_max": 100
  },
  "add_miss_num":  { //lesson07
    "oper": ["add"],
    "first_operand_min": 1,
    "first_operand_max": 12,
    "add_addend_min": 1,
    "add_addend_max": 10,
    "allowed_question_location": [0, 1]
  },
  "add_3_terms_0_10":  { 
    "oper": ["add"],
    "first_operand_min": 1,
    "first_operand_max": 10,
    "add_addend_min": 1,
    "add_addend_max": 10,
    "min_operators": 2,
    "max_operators": 2
  },
  "add_3_terms_0_20":  { 
    "oper": ["add"],
    "first_operand_min": 1,
    "first_operand_max": 20,
    "add_addend_min": 1,
    "add_addend_max": 20,
    "min_operators": 2,
    "max_operators": 2
  },
  "add_up_to_5_terms":  { 
    "oper": ["add"],
    "first_operand_min": 1,
    "first_operand_max": 10,
    "add_addend_min": 4,
    "add_addend_max": 20,
    "min_operators": 1,
    "max_operators": 4
  },
  "add_3_digits":  { 
    "oper": ["add"],
    "first_operand_min": 1,
    "first_operand_max": 999,
    "add_addend_min": 1,
    "add_addend_max": 999
  },
  "add_harder":  { 
    "oper": ["add"],
    "first_operand_min": 1,
    "first_operand_max": 999,
    "add_addend_min": 1,
    "add_addend_max": 999,
    "max_operators": 2
  },
  
  //
  // Subtractions
  //
  "sub_0_to_5":  {
    "oper": ["sub"],
    "first_operand_min": 1,
    "first_operand_max": 7,
    "sub_subtrahend_min": 1,
    "sub_subtrahend_max": 5
  },
  "sub_0_to_10":  { //lesson08
    "oper": ["sub"],
    "first_operand_min": 1,
    "first_operand_max": 10,
    "sub_subtrahend_min": 1,
    "sub_subtrahend_max": 10
  },
  "sub_0_to_20_10":  {
    "oper": ["sub"],
    "first_operand_min": 5,
    "first_operand_max": 20,
    "sub_subtrahend_min": 1,
    "sub_subtrahend_max": 10
  },
  "sub_0_to_20_20":  { //lesson09
    "oper": ["sub"],
    "first_operand_min": 8,
    "first_operand_max": 20,
    "sub_subtrahend_min": 1,
    "sub_subtrahend_max": 20
  },
  "mix_add_sum_0_20": {
    "oper": ["add", "sub"],
    "first_operand_min": 0,
    "first_operand_max": 20,
    "sub_subtrahend_min": 0,
    "sub_subtrahend_max": 15,
    "add_addend_min": 1,
    "add_addend_max": 15,
  },
  "sub_miss_num":  { 
    "oper": ["sub"],
    "first_operand_min": 1,
    "first_operand_max": 20,
    "sub_subtrahend_min": 1,
    "sub_subtrahend_max": 20,
    "allowed_question_location": [0, 1]
  },
  "sub_3_terms_0_10": {
    "oper": ["sub"],
    "first_operand_min": 0,
    "first_operand_max": 20,
    "sub_subtrahend_min": 0,
    "sub_subtrahend_max": 10,
    "min_operators": 2,
    "max_operators": 2
  },
  "mix_add_sum_0_15_3_terms": {
    "oper": ["add", "sub"],
    "oper_mix_allowed": true,
    "first_operand_min": 0,
    "first_operand_max": 10,
    "sub_subtrahend_min": 0,
    "sub_subtrahend_max": 15,
    "add_addend_min": 1,
    "add_addend_max": 15,
    "min_operators": 2,
    "max_operators": 2
  },
  "mix_add_sum_0_15_up_to_5_terms": {
    "oper": ["add", "sub"],
    "oper_mix_allowed": true,
    "first_operand_min": 0,
    "first_operand_max": 15,
    "sub_subtrahend_min": 0,
    "sub_subtrahend_max": 12,
    "add_addend_min": 1,
    "add_addend_max": 15,
    "min_operators": 2,
    "max_operators": 4
  },
  "sub_2_digits":  {
    "oper": ["sub"],
    "first_operand_min": 0,
    "first_operand_max": 99,
    "sub_subtrahend_min": 0,
    "sub_subtrahend_max": 99
  },
  "sub_3_digits":  {
    "oper": ["sub"],
    "first_operand_min": 0,
    "first_operand_max": 999,
    "sub_subtrahend_min": 0,
    "sub_subtrahend_max": 999
  },
  "sub_harder":  {
    "oper": ["sub"],
    "first_operand_min": 0,
    "first_operand_max": 999,
    "sub_subtrahend_min": 0,
    "sub_subtrahend_max": 999,
    "min_operators": 2,
    "max_operators": 2
  },
  
  //
  // Multiplications
  //
  "mul_table_2":  {
    "oper": ["mul"],
    "first_operand_min": 2,
    "first_operand_max": 2,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
  },  
  "mul_table_3":  {
    "oper": ["mul"],
    "first_operand_min": 3,
    "first_operand_max": 3,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
  },  
  "mul_table_4":  {
    "oper": ["mul"],
    "first_operand_min": 4,
    "first_operand_max": 4,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
  },  
  "mul_table_5":  {
    "oper": ["mul"],
    "first_operand_min": 5,
    "first_operand_max": 5,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
  },  
  "mul_table_1_to_5":  {
    "oper": ["mul"],
    "first_operand_min": 1,
    "first_operand_max": 5,
    "mul_multiplacand_min": 0,
    "mul_multiplacand_max": 10,
  },  
  "mul_table_6":  {
    "oper": ["mul"],
    "first_operand_min": 6,
    "first_operand_max": 6,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
  },  
  "mul_table_7":  {
    "oper": ["mul"],
    "first_operand_min": 7,
    "first_operand_max": 7,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
  },  
  "mul_table_0_to_7":  {
    "oper": ["mul"],
    "first_operand_min": 0,
    "first_operand_max": 7,
    "mul_multiplacand_min": 0,
    "mul_multiplacand_max": 10,
  },  
  "mul_table_8":  {
    "oper": ["mul"],
    "first_operand_min": 8,
    "first_operand_max": 8,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
  },  
  "mul_table_9":  {
    "oper": ["mul"],
    "first_operand_min": 9,
    "first_operand_max": 9,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
  },  
  "mul_table_10":  {
    "oper": ["mul"],
    "first_operand_min": 10,
    "first_operand_max": 10,
    "mul_multiplacand_min": 0,
    "mul_multiplacand_max": 10,
  },  
  "mul_table_0_to_10":  {
    "oper": ["mul"],
    "first_operand_min": 0,
    "first_operand_max": 10,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
  },  
  "mul_table_2_3_miss_num":  {
    "oper": ["mul"],
    "first_operand_min": 2,
    "first_operand_max": 3,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
    "allowed_question_location": [0, 1, MATHCARD_QUESTION_LOC_ANSWER]
  },  
  "mul_table_4_5_miss_num":  {
    "oper": ["mul"],
    "first_operand_min": 4,
    "first_operand_max": 5,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
    "allowed_question_location": [0, 1, MATHCARD_QUESTION_LOC_ANSWER]
  },  
  "mul_table_6_7_miss_num":  {
    "oper": ["mul"],
    "first_operand_min": 6,
    "first_operand_max": 7,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
    "allowed_question_location": [0, 1, MATHCARD_QUESTION_LOC_ANSWER]
  },  
  "mul_table_8_9_miss_num":  {
    "oper": ["mul"],
    "first_operand_min": 8,
    "first_operand_max": 9,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
    "allowed_question_location": [0, 1, MATHCARD_QUESTION_LOC_ANSWER]
  },  
  "mul_table_0_to_10_miss_num":  {
    "oper": ["mul"],
    "first_operand_min": 0,
    "first_operand_max": 10,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
    "allowed_question_location": [0, 1, MATHCARD_QUESTION_LOC_ANSWER]
  },
  "mul_table_11_to_12":  {
    "oper": ["mul"],
    "first_operand_min": 11,
    "first_operand_max": 12,
    "mul_multiplacand_min": 0,
    "mul_multiplacand_max": 12,
  },  
  "mul_table_13_to_15":  {
    "oper": ["mul"],
    "first_operand_min": 13,
    "first_operand_max": 15,
    "mul_multiplacand_min": 0,
    "mul_multiplacand_max": 15,
  },  
  
  
  
  //
  //Divisions
  //
  "div_by_2":  {
    "oper": ["div"],
    "div_divisor_min": 2,
    "div_divisor_max": 2
  },
  "div_by_3":  {
    "oper": ["div"],
    "div_divisor_min": 3,
    "div_divisor_max": 3
  },
  "div_by_4":  {
    "oper": ["div"],
    "div_divisor_min": 4,
    "div_divisor_max": 4
  },
  "div_by_5":  {
    "oper": ["div"],
    "div_divisor_min": 5,
    "div_divisor_max": 5
  },
  "div_by_1_to_5":  {
    "oper": ["div"],
    "div_divisor_min": 1,
    "div_divisor_max": 5
  },
  "div_by_6":  {
    "oper": ["div"],
    "div_divisor_min": 6,
    "div_divisor_max": 6
  },
  "div_by_7":  {
    "oper": ["div"],
    "div_divisor_min": 7,
    "div_divisor_max": 7
  },
  "div_by_8":  {
    "oper": ["div"],
    "div_divisor_min": 8,
    "div_divisor_max": 8
  },
  "div_by_9":  {
    "oper": ["div"],
    "div_divisor_min": 9,
    "div_divisor_max": 9
  },
  "div_by_10":  {
    "oper": ["div"],
    "div_divisor_min": 10,
    "div_divisor_max": 10
  },
  "div_by_1_to_10":  {
    "oper": ["div"],
    "div_divisor_min": 1,
    "div_divisor_max": 10
  },
  "mix_div_mul":  {
    "oper": ["div", "mul"],
    "first_operand_min": 0,
    "first_operand_max": 10,
    "mul_multiplacand_min": 1,
    "mul_multiplacand_max": 10,
    "div_divisor_min": 1,
    "div_divisor_max": 10
  },
  "div_by_1_to_10_missnum":  {
    "oper": ["div"],
    "allowed_question_location": [0, 1, MATHCARD_QUESTION_LOC_ANSWER],
    "div_divisor_min": 1,
    "div_divisor_max": 10
  },
  "div_by_11_to_12":  {
    "oper": ["div"],
    "div_dividand_max": 144,
    "div_result_max": 12,
    "div_divisor_min": 11,
    "div_divisor_max": 12
  },
  "div_by_13_to_15":  {
    "oper": ["div"],
    "div_dividand_max": 225,
    "div_result_max": 15,
    "div_divisor_min": 13,
    "div_divisor_max": 15
  },
  
  //
  // Relative numbers
  //
  "sub_0_to_20_negresults":  { 
    "oper": ["sub"],
    "first_operand_min": 0,
    "first_operand_max": 20,
    "sub_subtrahend_min": 1,
    "sub_subtrahend_max": 20,
    "sub_negative_result_allowed": true
  },  
  "add_0_to_10_relatives":  { 
    "oper": ["add"],
    "first_operand_min": -10,
    "first_operand_max": 10,
    "add_addend_min": -10,
    "add_addend_max": 10
  },  
  "add_0_to_20_relatives":  { 
    "oper": ["add"],
    "first_operand_min": -20,
    "first_operand_max": 20,
    "add_addend_min": -20,
    "add_addend_max": 20
  },  
  "sub_0_to_10_relatives":  { 
    "oper": ["sub"],
    "first_operand_min": -10,
    "first_operand_max": 10,
    "sub_subtrahend_min": -10,
    "sub_subtrahend_max": 10,
    "sub_negative_result_allowed": true
  },  
  "sub_0_to_20_relatives":  { 
    "oper": ["sub"],
    "first_operand_min": -20,
    "first_operand_max": 20,
    "sub_subtrahend_min": -20,
    "sub_subtrahend_max": 20,
    "sub_negative_result_allowed": true
  },
  "mix_add_sub_relatives_3_terms":  { 
    "oper": ["add", "sub"],
    "oper_mix_allowed": true,
    "first_operand_min": -20,
    "first_operand_max": 20,
    "sub_subtrahend_min": -10,
    "sub_subtrahend_max": 10,
    "add_addend_min": -10,
    "add_addend_max": 10,
    "sub_negative_result_allowed": true,
    "min_operators": 2,
    "max_operators": 2
  },
  "mix_add_sub_relatives_up_to_5_terms":  { 
    "oper": ["add", "sub"],
    "oper_mix_allowed": true,
    "first_operand_min": -20,
    "first_operand_max": 20,
    "sub_subtrahend_min": -10,
    "sub_subtrahend_max": 10,
    "add_addend_min": -10,
    "add_addend_max": 10,
    "sub_negative_result_allowed": true,
    "min_operators": 2,
    "max_operators": 4
  },
  "mul_table_0_to_10_relatives": {
    "oper": ["mul"],
    "first_operand_min": -10,
    "first_operand_max": 10,
    "mul_multiplacand_min": -10,
    "mul_multiplacand_max": 10,
  }, 
  "div_by_1_to_10_relatives":  {
    "oper": ["div"],
    "div_divisor_min": -10,
    "div_divisor_max": 10,
    "div_dividand_min": -100,
    "div_dividand_max": 100,
  },
  "mix_mul_div_relatives_up_to_4_terms":  
  {
    "oper": ["mul", "div"],
    "first_operand_min": -5,
    "first_operand_max": 5,
    "div_dividand_min": -100,
    "div_dividand_max": 100,
    "mul_multiplacand_min": -3,
    "mul_multiplacand_max": 3,
    "max_operators": 3,
    "oper_mix_allowed": true,
    "mul_multiplacand_zeroallowed": false
  },
  
  "test":  {
    "oper": ["sub", "add"],
    "first_operand_min": 1,
    "first_operand_max": 20,
    "sub_subtrahend_min": 0,
    "sub_subtrahend_max": 50,
    "max_operators":  6,
    "min_operators":  4,
    "oper_mix_allowed": true
  }
}//END_tmGlob_levelsSettings leave this so python can detect/extract data.



const AL_NOJUMP=-1;
const AL_JUMP_BACKWARD_BIG=0;
const AL_JUMP_BACKWARD_SMALL=1;
const AL_JUMP_FORWARD_SMALL=2;
const AL_JUMP_FORWARD_BIG=3;

let tmGlob_levelJumps={ //Format: ["big_jump_back", "jump_back", "jump_forward", "big_jump_forward"]
                        
  "add_1_to_3":           ["add_1_to_3", "add_1_to_3",              "add_sum_to_10", "add_sum_to_20"],
  "add_0_to_5":           ["add_1_to_3", "add_1_to_3",              "add_sum_to_10", "add_sum_to_20"],
  "add_sum_to_10":        ["add_1_to_3", "add_0_to_5",              "add_sum_to_15", "add_sum_to_20"], 
  "add_sum_to_15":        ["add_0_to_5", "add_sum_to_10",           "add_sum_to_20", "add_3_terms_0_10"], 
  "add_sum_to_20":        ["add_sum_to_10", "add_sum_to_15",        "add_3_terms_0_10", "add_3_terms_0_20"], 
  "add_3_terms_0_10":     ["add_sum_to_15", "add_sum_to_20",        "add_3_terms_0_20", "add_miss_num"], 
  "add_3_terms_0_20":     ["add_sum_to_20", "add_3_terms_0_10",     "add_miss_num", "add_2_digits"], 
  "add_miss_num":         ["add_3_terms_0_10", "add_3_terms_0_20",  "add_2_digits", "add_2_digits"], 
  "add_2_digits":         ["add_3_terms_0_20", "add_miss_num",      "sub_0_to_5", "sub_0_to_5"], 
  "add_up_to_5_terms":    ["add_3_terms_0_20", "add_3_terms_0_20", "add_up_to_5_terms", "add_up_to_5_terms"],
  "add_3_digits":         ["add_2_digits", "add_2_digits",          "add_3_digits", "add_3_digits"],
  "add_harder":           ["add_2_digits", "add_3_digits",          "add_harder", "add_harder"],
  
  
  "sub_0_to_5":           ["sub_0_to_5", "sub_0_to_5",              "sub_0_to_10", "sub_0_to_20_20"],
  "sub_0_to_10":          ["sub_0_to_5", "sub_0_to_5",              "sub_0_to_10", "sub_0_to_20_20"],
  "sub_0_to_20_10":       ["sub_0_to_5", "sub_0_to_10",             "sub_0_to_20_20", "sub_3_terms_0_10"],
  "sub_0_to_20_20":       ["sub_0_to_10", "sub_0_to_20_10",         "sub_3_terms_0_10", "mix_add_sum_0_15_3_terms"],
  "mix_add_sum_0_20":     ["sub_0_to_10", "sub_0_to_20_10",         "sub_3_terms_0_10", "mix_add_sum_0_15_3_terms"],
  "sub_miss_num":         ["sub_0_to_10", "sub_0_to_20_10",         "sub_3_terms_0_10", "mix_add_sum_0_15_3_terms"],
  "sub_3_terms_0_10":     ["sub_0_to_20_10", "sub_0_to_20_20",      "mul_table_2", "mul_table_3"],
  "mix_add_sum_0_15_3_terms": ["mix_add_sum_0_20", "sub_3_terms_0_10",      "mix_add_sum_0_15_up_to_5_terms", "mix_add_sum_0_15_up_to_5_terms"],
  "mix_add_sum_0_15_up_to_5_terms": ["mix_add_sum_0_15_3_terms", "mix_add_sum_0_15_3_terms",      "mix_add_sum_0_15_up_to_5_terms", "mix_add_sum_0_15_up_to_5_terms"],
  "sub_2_digits":         ["sub_0_to_20_20", "sub_2_digits",              "sub_3_digits", "sub_3_digits"],
  "sub_3_digits":         ["sub_2_digits", "sub_2_digits",              "sub_harder", "sub_harder"],
  "sub_harder":           ["sub_2_digits", "sub_3_digits",              "sub_harder", "sub_harder"],
  
  
  
  "mul_table_2":          ["sub_2_digits", "mul_table_2",              "mul_table_3", "mul_table_1_to_5"],
  "mul_table_3":          ["mul_table_2", "mul_table_3",               "mul_table_4", "mul_table_1_to_5"],
  "mul_table_4":          ["mul_table_3", "mul_table_4",               "mul_table_5", "mul_table_0_to_7"],
  "mul_table_5":          ["mul_table_4", "mul_table_5",               "mul_table_6", "mul_table_0_to_7"],
  "mul_table_1_to_5":     ["mul_table_3", "mul_table_1_to_5",          "mul_table_0_to_7", "mul_table_0_to_10"],
  "mul_table_6":          ["mul_table_4", "mul_table_6",               "mul_table_7", "mul_table_0_to_10"],
  "mul_table_7":          ["mul_table_4", "mul_table_7",               "mul_table_7", "mul_table_0_to_10"],
  "mul_table_0_to_7":     ["mul_table_4", "mul_table_0_to_7",          "mul_table_0_to_10", "mul_table_0_to_10_miss_num"],
  "mul_table_8":          ["mul_table_6", "mul_table_8",               "mul_table_9", "mul_table_0_to_10_miss_num"],
  "mul_table_9":          ["mul_table_7", "mul_table_9",               "mul_table_0_to_10", "mul_table_0_to_10_miss_num"],
  "mul_table_10":         ["mul_table_7", "mul_table_9",               "mul_table_0_to_10", "mul_table_0_to_10_miss_num"],
  "mul_table_0_to_10":     ["mul_table_1_to_5", "mul_table_0_to_7",    "mul_table_0_to_10_miss_num", "mul_table_0_to_10_miss_num"],
  "mul_table_2_3_miss_num": ["mul_table_2", "mul_table_3",             "mul_table_4_5_miss_num", "mul_table_0_to_10_miss_num"],
  "mul_table_4_5_miss_num": ["mul_table_4", "mul_table_5",             "mul_table_6_7_miss_num", "mul_table_0_to_10_miss_num"],
  "mul_table_6_7_miss_num": ["mul_table_6", "mul_table_7",             "mul_table_8_9_miss_num", "mul_table_0_to_10_miss_num"],
  "mul_table_8_9_miss_num": ["mul_table_8", "mul_table_9",             "div_by_1_to_5", "div_by_1_to_10"],
  "mul_table_0_to_10_miss_num": ["mul_table_0_to_10", "mul_table_0_to_10", "div_by_1_to_5", "div_by_1_to_10"],
  "mul_table_11_to_12":   ["mul_table_0_to_10", "mul_table_0_to_10",   "mul_table_13_to_15", "mul_table_13_to_15"],
  "mul_table_13_to_15":   ["mul_table_0_to_10", "mul_table_0_to_10",   "div_by_11_to_12", "div_by_13_to_15"],
  
  
  
  "div_by_2":             ["mul_table_2", "div_by_2",                  "div_by_3", "div_by_1_to_5"],
  "div_by_3":             ["mul_table_3", "div_by_3",                  "div_by_4", "div_by_1_to_5"],
  "div_by_4":             ["mul_table_4", "div_by_4",                  "div_by_5", "div_by_1_to_5"],
  "div_by_5":             ["mul_table_5", "div_by_5",                  "div_by_6", "div_by_7"],
  "div_by_1_to_5":        ["mul_table_1_to_5", "div_by_1_to_5",        "div_by_1_to_10", "div_by_1_to_10"],
  "div_by_6":             ["mul_table_6", "div_by_6",                  "div_by_7", "div_by_1_to_10"],
  "div_by_7":             ["mul_table_7", "div_by_7",                  "div_by_8", "div_by_1_to_10"],
  "div_by_8":             ["mul_table_8", "div_by_8",                  "div_by_9", "div_by_1_to_10"],
  "div_by_9":             ["mul_table_9", "div_by_9",                  "div_by_1_to_10", "div_by_1_to_10_missnum"],
  "div_by_10":            ["mul_table_10", "div_by_10",                "div_by_1_to_10", "div_by_1_to_10_missnum"],
  "div_by_1_to_10":       ["mul_table_0_to_10", "div_by_1_to_10",      "div_by_1_to_10_missnum", "sub_0_to_20_negresults"],
  "mix_div_mul":          ["div_by_1_to_5", "div_by_1_to_5",           "div_by_1_to_10_missnum", "sub_0_to_20_negresults"],
  "div_by_1_to_10_missnum": ["div_by_1_to_10", "div_by_1_to_10",       "sub_0_to_20_negresults", "sub_0_to_20_negresults"],
  "div_by_11_to_12":      ["mul_table_11_to_12", "div_by_11_to_12",    "div_by_13_to_15", "div_by_13_to_15"],
  "div_by_13_to_15":      ["mul_table_13_to_15", "div_by_11_to_12",    "div_by_13_to_15", "div_by_13_to_15"],
  
  
  
  "sub_0_to_20_negresults":  ["sub_0_to_20_negresults", "sub_0_to_20_negresults",    "add_0_to_10_relatives", "sub_0_to_10_relatives"],
  "add_0_to_10_relatives":  ["sub_0_to_20_negresults", "sub_0_to_20_negresults",    "add_0_to_20_relatives", "sub_0_to_10_relatives"],
  "add_0_to_20_relatives":  ["sub_0_to_20_negresults", "add_0_to_10_relatives",    "sub_0_to_10_relatives", "sub_0_to_20_relatives"],
  "sub_0_to_10_relatives":  ["sub_0_to_20_negresults", "sub_0_to_10_relatives",    "sub_0_to_20_relatives", "mix_add_sub_relatives_3_terms"],
  "sub_0_to_20_relatives":  ["sub_0_to_20_negresults", "sub_0_to_10_relatives",    "mix_add_sub_relatives_3_terms", "mix_add_sub_relatives_3_terms"],
  "mix_add_sub_relatives_3_terms":  ["sub_0_to_20_negresults", "sub_0_to_20_relatives",    "mix_add_sub_relatives_up_to_5_terms", "mul_table_0_to_10_relatives"],
  "mix_add_sub_relatives_up_to_5_terms":  ["sub_0_to_20_negresults", "mix_add_sub_relatives_3_terms",    "mul_table_0_to_10_relatives", "mix_mul_div_relatives_up_to_4_terms"],
  "mul_table_0_to_10_relatives":  ["sub_0_to_20_relatives", "mix_add_sub_relatives_3_terms",    "div_by_1_to_10_relatives", "mix_mul_div_relatives_up_to_4_terms"],
  "div_by_1_to_10_relatives":  ["sub_0_to_20_relatives", "mul_table_0_to_10_relatives",    "mix_mul_div_relatives_up_to_4_terms", "mix_mul_div_relatives_up_to_4_terms"],
  "mix_mul_div_relatives_up_to_4_terms":  ["mul_table_0_to_10_relatives", "div_by_1_to_10_relatives",    "mix_mul_div_relatives_up_to_4_terms", "mix_mul_div_relatives_up_to_4_terms"]
}
