<template>
  <el-form label-position="right" label-width="100px">
    <el-form-item label="API key: ">
      <el-tooltip content="输入OpenAI的API key" placement="top" :hide-after="hideAfter">
        <el-input v-model="apikey" placeholder="输入OpenAI的API key" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="正向代理: ">
      <el-tooltip content="如果你是通过自己的VPN软件软件访问openai,在此输入代理地址" placement="top" :hide-after="hideAfter">
        <el-input v-model="proxy" placeholder="输入正向代理地址" />
      </el-tooltip>
    </el-form-item>

    <el-form-item label="反向代理: ">
      <el-tooltip content="如果你是通过国内一些服务器提供的反向代理地址访问openai，在此输入地址" placement="top" :hide-after="hideAfter">
        <el-input v-model="apiBase" placeholder="输入反向代理地址" />
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
    <el-form-item>
    <el-button type="primary" @click="onSubmit">保存</el-button>
    </el-form-item>

    <el-divider />

    <el-form-item label="保留分支: ">
      <el-tooltip content="重新编辑输入内容并生成结果后，是否保留原有的对话内容分支" placement="top" :hide-after="hideAfter">
        <el-switch v-model="saveEdit" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="保留标签: ">
      <el-tooltip content="每次提交输入后仍保留所有扩展标签" placement="top" :hide-after="hideAfter">
        <el-switch v-model="keepTag" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="自动隐藏: ">
      <el-tooltip content="不使用后1分钟自动隐藏窗口" placement="top" :hide-after="hideAfter">
        <el-switch v-model="autoHide" />
      </el-tooltip>
    </el-form-item>


    <el-divider />
    
    <el-form-item label="全局Ask热键: ">
      <el-checkbox-group v-model="askHotkeyModifyKey">
        <el-checkbox label="Cmd" />
        <el-checkbox label="Control" />
        <el-checkbox label="Option" />
        <el-checkbox label="Shift"/>
      </el-checkbox-group>
      <el-tooltip content="设置全局Ask的快捷键，这是系统级的全局快捷键，注意不要和系统中已有的快捷键冲突" placement="top" :hide-after="hideAfter">
        <el-input v-model="askHotKeyMainKey" @click="recordAskHotkey" maxlength="1">
        </el-input>
      </el-tooltip>
        
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="setAskHotkey">设置</el-button>
        <el-button @click="restorDefaultHotkey">恢复默认</el-button>
      </el-form-item>

    <el-divider />
    
    <el-form-item label="主题: ">
      <el-radio-group v-model="themeValue">
          <el-radio-button label="dark" />
          <el-radio-button label="light" />
          <el-radio-button label="auto" />
        </el-radio-group>
    </el-form-item>
    <el-form-item>
      <el-button @click="openLogFile">日志</el-button>
      <el-button @click="openDir">配置目录</el-button>
    </el-form-item>

  </el-form>
</template>
  
<script setup>
import { ref, onMounted, inject, watch} from 'vue'
import axios from 'axios';
import { remote,ipcRenderer } from "electron"
import os from 'os';
import path from 'path';
import { ElMessage } from 'element-plus'

let apikey = ref('')
let proxy = ref('')
let apiBase = ref('')
let inputLimit = ref(2000)
let maxContext = ref(2000)
let saveEdit = ref(false)
let hideAfter = ref(0)
let step = ref(500)
let autoHide = ref(false)
const askHotKeyMainKey = ref('')
const askHotkeyModifyKey = ref(['']);
const askHotKey = ref('')


const isMac = window.navigator.userAgent.includes('Mac');
const defaultAskHotkey = isMac ? 'Option+K' : 'Alt+K';

// 监测autoHide的值的变化，并发送给主进程
autoHide.value = localStorage.getItem('autoHide') === "true"
ipcRenderer.send('autoHide', autoHide.value)
watch(autoHide, (newVal) => {
  ipcRenderer.send('autoHide', newVal)
  localStorage.setItem('autoHide', newVal)
})

const keepTag = inject('keepTag')
const keepTagLocal = ref(keepTag.value)
watch(keepTagLocal, (newVal) => {
  keepTag.value = newVal
})

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
    apiBase.value = response['data']['data'][9]
  }).catch(error => {
    console.error(`load config 失败： ${error.message}`);
  });
}

const saveConfig = () => {
  axios.post('http://127.0.0.1:7860/run/save_config_from_brainshell', {
    data: [apikey.value, proxy.value, inputLimit.value, maxContext.value, saveEdit.value, apiBase.value]
  }).then(() => {
  }).catch(error => {
    console.error(error);
  });
  // UI配置值保存到localStorage中
  localStorage.setItem('keepTag', keepTag.value)
}

const openLogFile = () => {
  const logFilePath = path.join(os.homedir(), 'braindoor', 'run.log');
  remote.shell.openPath(logFilePath);
}

const openDir = () => {
  const dirPath = path.join(os.homedir(), 'braindoor');
  remote.shell.openPath(dirPath);
}

function setAskHotkey() {

  // 首先判断askHotKeyMainKey和askHotKeyModifyKey是否为空
  if (askHotKeyMainKey.value === '' || askHotkeyModifyKey.value.length === 0) {
    ElMessage.error('修饰键和主键不能为空')
    return;
  }

  // 把askHotKeyMainKey和askHotkeyModifyKey拼接成字符串，存储到askHotKey中
  askHotkeyModifyKey.value = askHotkeyModifyKey.value.filter(value => value && value.trim());
  askHotKey.value = askHotkeyModifyKey.value.join('+') + '+' + askHotKeyMainKey.value;
  ipcRenderer.send('setAskHotkey', askHotKey.value);
  localStorage.setItem('askHotkey', askHotKey.value);
  ElMessage.success(`Ask快捷键设置成功：${askHotKey.value}`)
}

// 恢复默认的快捷键
function restorDefaultHotkey() {
  askHotKey.value = defaultAskHotkey;
  localStorage.setItem('askHotkey', askHotKey.value);
}


function loadHotkeyFromLocalStorage() {
  const hotkey = localStorage.getItem('askHotkey');
  if (hotkey) {
    askHotKey.value = hotkey;
  } else {
    askHotKey.value = defaultAskHotkey;
  }
}

onMounted(() => {
  keepTag.value = localStorage.getItem('keepTag') === "true" 
  // 从服务端读取一些配置
  loadConfig(); 
  loadHotkeyFromLocalStorage();
})

</script>
  
<style></style>