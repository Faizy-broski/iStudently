import { DEFAULT_LOGIN_PAGE_CONFIG, type LoginPageConfig } from '@studently/api-client'

import { colors } from '@/lib/colors'

/** Login page defaults with the app's brand tokens for every colour (src/global.css). */
export function loginPageDefaults(): LoginPageConfig {
  return {
    ...DEFAULT_LOGIN_PAGE_CONFIG,
    gradient_from: colors.gradient1Start,
    gradient_to: colors.gradient1End,
    background_color: colors.brand,
    text_color_left: colors.brand,
    text_color_right: colors.white,
  }
}
