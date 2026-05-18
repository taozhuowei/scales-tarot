<template>
  <text class="typewriter-text">{{ displayed_text }}</text>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { createTypewriterModel } from '../../../core/utils/typing/typewriter_model'
import { prefersReducedMotion } from '../../../core/utils/accessibility'

const props = withDefaults(defineProps<{
  text: string
  startDelay?: number
  charInterval?: number
  instant?: boolean
}>(), {
  startDelay: 0,
  charInterval: 28,
  instant: false,
})

const displayed_text = ref('')

// Create typewriter model
let typewriterModel: ReturnType<typeof createTypewriterModel> | null = null

function createModel() {
  typewriterModel = createTypewriterModel(
    {
      text: props.text,
      startDelay: props.startDelay,
      charInterval: props.charInterval,
      instant: props.instant || prefersReducedMotion(),
    },
    {
      onUpdate: (text) => {
        displayed_text.value = text
      },
      onComplete: () => {
        // Animation complete - no-op since we update via onUpdate
      },
    },
  )
}

// Watch for prop changes and restart animation
watch(
  () => props.text,
  (newText) => {
    if (typewriterModel) {
      typewriterModel.stop()
    }
    if (newText) {
      createModel()
      typewriterModel?.start()
    } else {
      displayed_text.value = ''
    }
  },
)

onMounted(() => {
  createModel()
  typewriterModel?.start()
})

onUnmounted(() => {
  typewriterModel?.stop()
})
</script>

<style scoped>
.typewriter-text {
  display: block;
  white-space: pre-wrap;
  contain: content;
}
</style>
