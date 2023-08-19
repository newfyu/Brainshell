<template>
   <webview
    ref="webviewRef"
    src="https://claude.ai/chats"
    style="display:inline-flex; width:350px; height:600px;"
    @new-window="handleNewWindow"
    @will-navigate="handleNavigation"
  ></webview>
  <img alt="DeskBrain logo" src="../assets/logo.png" class="center">
  <el-row justify="center"><el-text>
      <h1>OpenCopilot</h1>
    </el-text></el-row>
  <el-row justify="center"><el-text size="large">Version 0.5.0</el-text></el-row>
  <!-- <el-row justify="center"><el-text><h3>帮助文档</h3></el-text></el-row> -->
  <!-- <el-row justify="center"><a href="https://gitee.com/vmn171/deskbrain">https://gitee.com/vmn171/deskbrain</a></el-row> -->

  <el-row justify="center"><el-text><a href="https://opencopilot.rtfd.io">
        <h3>帮助文档</h3>
      </a></el-text></el-row>

  <el-row justify="center"><el-text>
      <h3>Github</h3>
    </el-text></el-row>
  <el-row justify="center"><el-text>OpenCopilot:&nbsp;<a
        href="https://github.com/newfyu/OpenCopilot">github.com/newfyu/OpenCopilot</a></el-text></el-row>
  <el-row justify="center"><el-text>Braindoor:&nbsp;<a
        href="https://github.com/newfyu/Braindoor">github.com/newfyu/Braindoor</a></el-text></el-row>
  <el-row justify="center"><el-text>Brainshell:&nbsp;<a
        href="https://github.com/newfyu/Brainshell">github.com/newfyu/Brainshell</a></el-text></el-row>

  <el-row justify="center"><el-text>
      <h3>反馈</h3>
    </el-text></el-row>
  <el-row justify="center"><el-text>邮箱：lhan12345@hotmail.com</el-text></el-row>
  <br>
  <el-row justify="center"><el-text> 贡献者：lhan, hjuan</el-text></el-row>
</template>

<script setup>
import { ref } from 'vue';
const webviewRef = ref(null);

const handleNewWindow = (e) => {
  e.preventDefault();
  webviewRef.value.loadURL(e.url);
}

const handleNavigation = (e) => {
  e.preventDefault();
  webviewRef.value.loadURL(e.url);
}

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h1 {
  margin: 20px 0 0;
}

h3 {
  margin: 30px 0 0;
}

ul {
  list-style-type: none;
  padding: 0;
}

a {
  color: #3375b9;
}

.center {
  display: block;
  /* 设置图片为块级元素 */
  margin: auto;
  /* 让图片水平和垂直居中 */
}

.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
}</style>
