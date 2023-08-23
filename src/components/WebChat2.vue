<template>
   <webview
    ref="webviewRef"
    src="https://claude.ai/chats"
    style="display:flex; width:100%; height:90%"
    @dom-ready="onWebviewDomReady"
  ></webview>
  
</template>

<script setup>
import { ref, defineExpose } from 'vue';
const webviewRef = ref(null);

const inputTextIntoWebview = (text) => {
  const escapedText = JSON.stringify(text);
  webviewRef.value.executeJavaScript(`
  {
  let textarea = document.querySelector('.ProseMirror');
  if (textarea) {
    textarea.innerText = ${escapedText};
  }
  }
`)
}


const onWebviewDomReady = () => {
  // webviewRef.value.openDevTools();
  }



const refreshWebview = () => {
  if (webviewRef.value) {
    webviewRef.value.reload();
  }
}
// 暴露方法给父组件
defineExpose({
  refreshWebview,
  inputTextIntoWebview
});

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
