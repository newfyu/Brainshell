<template>
   <webview
    ref="webviewRef"
    src="https://www.bing.com/search?q=Bing+AI&showconv=1&FORM=hpcodx"
    style="display:flex; width:100%; height:90%"
  ></webview>
  
</template>

<script setup>
import { ref, defineExpose } from 'vue';
const webviewRef = ref(null);

const refreshWebview = () => {
  if (webviewRef.value) {
    webviewRef.value.reload();
  }
}
// 暴露方法给父组件
defineExpose({
  refreshWebview
});

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
