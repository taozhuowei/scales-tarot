<template>
  <text class="typewriter-text">{{ displayed_text }}</text>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { createTypewriterModel } from '../utils/typing/typewriter_model'

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
      instant: props.instant,
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
  () => [props.text, props.startDelay, props.charInterval, props.instant],
  () => {
    if (typewriterModel) {
      typewriterModel.stop()
    }
    createModel()
    typewriterModel?.start()
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
