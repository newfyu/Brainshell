<template>
  <el-form label-position="right" label-width="100px">
    <el-form-item label="API key: ">
      <el-tooltip content="输入OpenAI的API key" placement="top" :hide-after="hideAfter">
        <el-input v-model="apikey" placeholder="输入OpenAI的API key" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="Proxy: ">
      <el-tooltip content="输入代理地址" placement="top" :hide-after="hideAfter">
        <el-input v-model="proxy" placeholder="输入代理地址" />
      </el-tooltip>
    </el-form-item>

    <el-form-item label="最长输入: ">
      <el-tooltip content="输入的最长token，超过后会转换为全文阅读模式" placement="top" :hide-after="hideAfter">
        <el-input-number v-model="inputLimit" :step="step" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="最长上下文: ">
      <el-tooltip content="对话最长的上下文token，超过后会截断" placement="top" :hide-after="hideAfter">
        <el-input-number v-model="maxContext" :step="step" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="保留编辑分支: ">
      <el-tooltip content="重新编辑输入内容并生成结果后，是否保留原有的对话内容分支" placement="top" :hide-after="hideAfter">
        <el-switch v-model="saveEdit" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="提交清除标签: ">
      <el-tooltip content="每次提交输入后清除所有扩展标签" placement="top" :hide-after="hideAfter">
        <el-switch v-model="removeTag" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="自动执行代码: ">
      <el-tooltip content="applescript/vbscript插件生成的代码是否自动执行" placement="top" :hide-after="hideAfter">
        <el-switch v-model="autoExce" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="主题: ">
      <el-radio-group v-model="themeValue">
          <el-radio-button label="dark" />
          <el-radio-button label="light" />
          <el-radio-button label="auto" />
        </el-radio-group>
    </el-form-item>
    <el-form-item>
      <el-button @click="openLogFile">日志</el-button>
      <el-button @click="openDir">插件目录</el-button>
    </el-form-item>
    <el-form-item>
    <el-button type="primary" @click="onSubmit">保存</el-button>
    </el-form-item>
  </el-form>
</template>
  
<script setup>
import { ref, onMounted, inject, watch} from 'vue'
import axios from 'axios';
import { remote } from "electron"
import os from 'os';
import path from 'path';

let apikey = ref('')
let proxy = ref('')
let inputLimit = ref(2000)
let maxContext = ref(2000)
let saveEdit = ref(false)
let hideAfter = ref(0)
let step = ref(500)
let removeTag = ref(false)
let autoExce = ref(false)


const theme = inject('theme')
const themeValue = ref(theme.value)
watch(themeValue, (newVal) => {
  theme.value = newVal
})

const onSubmit = () => {
  saveConfig()
}

const loadConfig = () => {
  axios.post('http://127.0.0.1:7860/run/general_config', {
    data: []
  }).then((response) => {
    apikey.value = response['data']['data'][0]
    proxy.value = response['data']['data'][5]
    inputLimit.value = response['data']['data'][6]
    maxContext.value = response['data']['data'][7]
    saveEdit.value = response['data']['data'][8]
  }).catch(error => {
    console.error(`load config 失败： ${error.message}`);
  });
}

const saveConfig = () => {
  axios.post('http://127.0.0.1:7860/run/save_config_from_brainshell', {
    data: [apikey.value, proxy.value, inputLimit.value, maxContext.value, saveEdit.value]
  }).then(() => {
  }).catch(error => {
    console.error(error);
  });
  // UI配置值保存到localStorage中
  localStorage.setItem('removeTag', removeTag.value)
  localStorage.setItem('autoExce', autoExce.value)
}

const openLogFile = () => {
  const logFilePath = path.join(os.homedir(), 'braindoor', 'run.log');
  remote.shell.openPath(logFilePath);
}

const openDir = () => {
  const dirPath = path.join(os.homedir(), 'braindoor');
  remote.shell.openPath(dirPath);
}

onMounted(() => {
  // 从localStorage中读取一些UI配置
  removeTag.value = localStorage.getItem('removeTag') === "true" 
  autoExce.value = localStorage.getItem('autoExce') === "true"
  // 从服务端读取一些配置
  loadConfig(); 
})

</script>
  
<style></style>
  