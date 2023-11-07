<template>
    <pre ref="logRef" class="log" :style="{ color: textColor }">{{ logContent }}</pre>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import path from 'path'
import os from 'os'
import fs from 'fs'

let logFilePath = path.join(os.homedir(), 'braindoor', 'run.log')
let logContent = ref('')
let logRef = ref(null)

// 根据localStorage中的theme值设置字体颜色
let textColor = localStorage.getItem('theme') === 'dark' ? '#fff' : '#000'

// 每隔3秒读取一次log文件，并且滚动到最底部
let timer = null
onMounted(() => {
  timer = setInterval(() => {
    logContent.value = fs.readFileSync(logFilePath, 'utf-8').split('\n').slice(-50).join('\n')
    scrollToBottom() 
  }, 3000)
})

// 组件退出的时候取消读取
onUnmounted(() => {
  clearInterval(timer)
})

// logRef滚动到最底部
const scrollToBottom = () => {
  logRef.value.scrollIntoView(false)
}
</script>

<style>
pre.log {
  white-space: pre-wrap;
}
</style>
