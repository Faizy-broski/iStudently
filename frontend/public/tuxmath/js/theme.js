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


const DEF_BASE="images/";

const THEME_DEFAULT_BACKGROUDS=[
  DEF_BASE+"backgrounds/0.jpg",
  DEF_BASE+"backgrounds/1.jpg",
  DEF_BASE+"backgrounds/2.jpg",
  DEF_BASE+"backgrounds/3.jpg",
  DEF_BASE+"backgrounds/4.jpg",
  DEF_BASE+"backgrounds/5.jpg",
  DEF_BASE+"backgrounds/6.jpg",
  DEF_BASE+"backgrounds/7.jpg"
];

const THEME_DEFAULT_IMAGE_COMET=DEF_BASE+"sprites/comet-anim.png";
const THEME_DEFAULT_IMAGE_COMET_EXPLODE=DEF_BASE+"sprites/cometex-anim.png";
const THEME_DEFAULT_IMAGE_COMET_BONUS=DEF_BASE+"sprites/bonus-comet-anim.png";
const THEME_DEFAULT_IMAGE_COMET_BONUS_EXPLODE=DEF_BASE+"sprites/bonus-cometex-anim.png";
const THEME_DEFAULT_IMAGE_STEAM=DEF_BASE+"sprites/steam-anim.png";

const THEME_DEFAULT_IGLOOHEALTHSTATUS=[
  DEF_BASE+"sprites/igloo-melted-anim.png",
  DEF_BASE+"sprites/igloo-half.png",
  DEF_BASE+"sprites/igloo-intact.png"
];
const THEME_DEFAULT_IMAGES_PENGUIN_SIT=[DEF_BASE+"sprites/penguin-flapdown.png", DEF_BASE+"sprites/penguin-flapup.png"];
const THEME_DEFAULT_IMAGE_PENGUIN_HIT=DEF_BASE+"sprites/penguin-incoming.png";
const THEME_DEFAULT_IMAGE_PENGUIN_STANDUP=DEF_BASE+"sprites/penguin-standing-up.png";
const THEME_DEFAULT_ANIM_PENGUIN_ANIMWALK=DEF_BASE+"sprites/penguin-walk.png";
const THEME_DEFAULT_ANIM_PENGUIN_ANIMDANCE=DEF_BASE+"sprites/tux-egypt-anim.png";

const THEME_DEFAULT_IMAGE_CONSOLE=DEF_BASE+"sprites/console_led.png";
const THEME_DEFAULT_IMAGE_CONSOLE_DIMS=[168, 110];

const THEME_DEFAULT_IMAGE_CONSOLETUX_NORMAL=DEF_BASE+"sprites/tux-sit.png";
const THEME_DEFAULT_IMAGE_CONSOLETUX_PRESTART=DEF_BASE+"sprites/tux-relax-prestart.png";
const THEME_DEFAULT_IMAGE_CONSOLETUX_ANIMSTART=DEF_BASE+"sprites/tux-startLevel-anim.png";
const THEME_DEFAULT_IMAGES_CONSOLETUX_TYPING=[DEF_BASE+"sprites/tux-console1.png", DEF_BASE+"sprites/tux-console2.png", DEF_BASE+"sprites/tux-console3.png", DEF_BASE+"sprites/tux-console4.png"];
const THEME_DEFAULT_IMAGE_CONSOLETUX_MISTAKE=DEF_BASE+"sprites/tux-yipe.png";
const THEME_DEFAULT_IMAGE_CONSOLETUX_ANIMIGLOODESTROYED=DEF_BASE+"sprites/tux-fist-anim.png";



const THEME_DEFAULT_BACKGROUND_MUSICS=[
  "music/01_rush.ogg",
  "music/02_on_the_edge_of_the_universe.ogg",
  "music/03_gravity.ogg",
  "music/game.ogg",
  "music/game2.ogg",
  "music/game3.ogg"
];

const THEME_DEFAULT_SFX_LEVELSTART="sfx/alarm.wav";
const THEME_DEFAULT_SFX_ANSWER_BAD="sfx/buzz.wav";
const THEME_DEFAULT_SFX_COMETDESTROY="sfx/sizzling.wav";
const THEME_DEFAULT_SFX_COMETDESTROY_MULTIPLE="sfx/cheer.wav";
const THEME_DEFAULT_SFX_LASER="sfx/laser.wav";
const THEME_DEFAULT_SFX_IGLOO_DESTROY_HALF="sfx/sizzling.wav";
const THEME_DEFAULT_SFX_IGLOO_DESTROY_FULL="sfx/sizzling.wav";
const THEME_DEFAULT_SFX_IGLOO_DESTROY_LASER="sfx/explosion.wav";
const THEME_DEFAULT_SFX_KEYPRESS="sfx/tock.wav";
const THEME_DEFAULT_SFX_BONUS_INCOMING="sfx/towerclock.wav";
const THEME_DEFAULT_SFX_BONUS_DESTROYED="sfx/cheer.wav";


class Theme
{
  constructor()
  {
    this.loadDefault();
  }
  
  loadDefault()
  {
    this.background_images=THEME_DEFAULT_BACKGROUDS;
    this.background_musics=THEME_DEFAULT_BACKGROUND_MUSICS;
    
    this.image_comet=THEME_DEFAULT_IMAGE_COMET;
    this.image_comet_explode=THEME_DEFAULT_IMAGE_COMET_EXPLODE;
    this.image_comet_bonus=THEME_DEFAULT_IMAGE_COMET_BONUS;
    this.image_comet_bonus_explode=THEME_DEFAULT_IMAGE_COMET_BONUS_EXPLODE;
    this.image_steam=THEME_DEFAULT_IMAGE_STEAM;
    this.image_iglooHealthStatus=THEME_DEFAULT_IGLOOHEALTHSTATUS;
    
    this.hasPenguins=true;
    this.images_penguin_sit=THEME_DEFAULT_IMAGES_PENGUIN_SIT;
    this.image_penguin_hit=THEME_DEFAULT_IMAGE_PENGUIN_HIT;
    this.image_penguin_standup=THEME_DEFAULT_IMAGE_PENGUIN_STANDUP;
    this.anim_penguin_animwalk=THEME_DEFAULT_ANIM_PENGUIN_ANIMWALK;
    this.anim_penguin_animdance=THEME_DEFAULT_ANIM_PENGUIN_ANIMDANCE;
    
    this.image_console=THEME_DEFAULT_IMAGE_CONSOLE;
    this.image_console_dims=THEME_DEFAULT_IMAGE_CONSOLE_DIMS;
    this.image_consoletux_normal=THEME_DEFAULT_IMAGE_CONSOLETUX_NORMAL;
    this.image_consoletux_prestart=THEME_DEFAULT_IMAGE_CONSOLETUX_PRESTART;
    this.image_consoletux_animstart=THEME_DEFAULT_IMAGE_CONSOLETUX_ANIMSTART;
    this.images_consoletux_typing=THEME_DEFAULT_IMAGES_CONSOLETUX_TYPING;
    this.image_consoletux_mistake=THEME_DEFAULT_IMAGE_CONSOLETUX_MISTAKE;
    this.image_consoletux_animigloodestroyed=THEME_DEFAULT_IMAGE_CONSOLETUX_ANIMIGLOODESTROYED;
    
    this.sfx_levelstart=THEME_DEFAULT_SFX_LEVELSTART;
    this.sfx_answer_bad=THEME_DEFAULT_SFX_ANSWER_BAD;
    this.sfx_cometdestroy=THEME_DEFAULT_SFX_COMETDESTROY;
    this.sfx_cometdestroy_multiple=THEME_DEFAULT_SFX_COMETDESTROY_MULTIPLE;
    this.sfx_laser=THEME_DEFAULT_SFX_LASER;
    this.sfx_igloo_destroy_half=THEME_DEFAULT_SFX_IGLOO_DESTROY_HALF;
    this.sfx_igloo_destroy_full=THEME_DEFAULT_SFX_IGLOO_DESTROY_FULL;
    this.sfx_igloo_destroy_laser=THEME_DEFAULT_SFX_IGLOO_DESTROY_LASER;
    this.sfx_keypress=THEME_DEFAULT_SFX_KEYPRESS;
    this.sfx_bonus_incoming=THEME_DEFAULT_SFX_BONUS_INCOMING;
    this.sfx_bonus_destroyed=THEME_DEFAULT_SFX_BONUS_DESTROYED;
    
    this.boolRepairAnim=false;
  }  
  
  chooseBackground()
  {
    return getRandomArrayElt(this.background_images);
  }
  
  chooseBackgroundMusic()
  {
    return getRandomArrayElt(this.background_musics);
  }
  
}

class Theme_classic extends Theme
{
  //nothing to do here, just loads defaults...
}


//
// Thème original
//

const THEME_CLASSIC_IGLOOHEALTHSTATUS=[
  DEF_BASE+"sprites/theme-classic/csplode-orange-anim.png",
  DEF_BASE+"sprites/theme-classic/city-orange-noshield.png",
  DEF_BASE+"sprites/theme-classic/city-orange-shield-anim.png"
];

const THEME_AFRIKALAN_SFX_IGLOO_DESTROY_HALF="sfx/theme-classic/shieldsdown.wav";
const THEME_AFRIKALAN_SFX_IGLOO_DESTROY_FULL="sfx/explosion.wav";

class Theme_original extends Theme
{
  constructor()
  {
    super();
    this.overrideAssets();
  }
  
  overrideAssets()
  {
    this.image_iglooHealthStatus=THEME_CLASSIC_IGLOOHEALTHSTATUS;
    this.hasPenguins=false;
    
    this.sfx_igloo_destroy_half=THEME_AFRIKALAN_SFX_IGLOO_DESTROY_HALF;
    this.sfx_igloo_destroy_full=THEME_AFRIKALAN_SFX_IGLOO_DESTROY_FULL;
  }
}




//
// Thème Afrikalan
//

const THEME_AFRIKALAN_BACKGROUDS=[
  DEF_BASE+"backgrounds/theme-afrikalan/0.jpg",
  DEF_BASE+"backgrounds/theme-afrikalan/1.jpg",
  DEF_BASE+"backgrounds/theme-afrikalan/2.jpg",
  DEF_BASE+"backgrounds/theme-afrikalan/3.jpg",
  DEF_BASE+"backgrounds/theme-afrikalan/4.jpg",
  DEF_BASE+"backgrounds/theme-afrikalan/5.jpg",
  DEF_BASE+"backgrounds/theme-afrikalan/6.jpg",
  DEF_BASE+"backgrounds/theme-afrikalan/7.jpg"
];

const THEME_AFRIKALAN_IGLOOHEALTHSTATUS=[
  DEF_BASE+"sprites/theme-afrikalan/igloo-melted-anim.png",
  DEF_BASE+"sprites/theme-afrikalan/igloo-half.png",
  DEF_BASE+"sprites/theme-afrikalan/igloo-intact.png"
];

const THEME_AFRIKALAN_IMAGE_CONSOLETUX_NORMAL=DEF_BASE+"sprites/theme-afrikalan/tux-sit.png";
const THEME_AFRIKALAN_IMAGE_CONSOLETUX_PRESTART=DEF_BASE+"sprites/theme-afrikalan/tux-relax-prestart.png";
const THEME_AFRIKALAN_IMAGE_CONSOLETUX_ANIMSTART=DEF_BASE+"sprites/theme-afrikalan/tux-startLevel-anim.png";
const THEME_AFRIKALAN_IMAGES_CONSOLETUX_TYPING=[DEF_BASE+"sprites/theme-afrikalan/tux-console1.png", DEF_BASE+"sprites/theme-afrikalan/tux-console2.png", DEF_BASE+"sprites/theme-afrikalan/tux-console3.png", DEF_BASE+"sprites/theme-afrikalan/tux-console4.png"];
const THEME_AFRIKALAN_IMAGE_CONSOLETUX_ANIMIGLOODESTROYED=DEF_BASE+"sprites/theme-afrikalan/tux-fist-anim.png";

class Theme_afrikalan extends Theme
{
  constructor()
  {
    super();
    this.overrideAssets();
  }
  
  overrideAssets()
  {
    this.background_images=THEME_AFRIKALAN_BACKGROUDS;
    this.image_iglooHealthStatus=THEME_AFRIKALAN_IGLOOHEALTHSTATUS;
    this.image_consoletux_normal=THEME_AFRIKALAN_IMAGE_CONSOLETUX_NORMAL;
    this.image_consoletux_prestart=THEME_AFRIKALAN_IMAGE_CONSOLETUX_PRESTART;
    this.image_consoletux_animstart=THEME_AFRIKALAN_IMAGE_CONSOLETUX_ANIMSTART;
    this.images_consoletux_typing=THEME_AFRIKALAN_IMAGES_CONSOLETUX_TYPING;
    this.image_consoletux_animigloodestroyed=THEME_AFRIKALAN_IMAGE_CONSOLETUX_ANIMIGLOODESTROYED;
  }
}



//
// Allow dynamic theme class call
//

const THEMES={"classic": Theme_classic, "original": Theme_original, "afrikalan": Theme_afrikalan}
