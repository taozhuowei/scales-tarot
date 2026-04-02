import { defineStore } from 'pinia'
import { ref } from 'vue'

// 简化的用户配置存储
export const useUserStore = defineStore('user', () => {
  const cardBackImage = ref('/static/themes/golden_dawn/tarot/card_back.jpeg')

  return {
    cardBackImage
  }
})
