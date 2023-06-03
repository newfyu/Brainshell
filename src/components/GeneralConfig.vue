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
      <el-tooltip content="编辑对话并重新生成结果后，是否保留原有的对话内容" placement="top" :hide-after="hideAfter">
        <el-switch v-model="saveEdit" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="主题: ">
      <!-- <el-tooltip content="更换主题，默认跟随系统" placement="top" :hide-after="hideAfter">
        <el-switch v-model="themeValue" active-value="dark" inactive-value="light" />
      </el-tooltip> -->
      <el-radio-group v-model="themeValue">
          <el-radio-button label="dark" />
          <el-radio-button label="light" />
          <el-radio-button label="auto" />
        </el-radio-group>
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="onSubmit">保存</el-button>
    </el-form-item>
  </el-form>
</template>
  
<script setup>
import { ref, onMounted, inject, watch } from 'vue'
import axios from 'axios';

let apikey = ref('')
let proxy = ref('')
let inputLimit = ref(2000)
let maxContext = ref(2000)
let saveEdit = ref(false)
let hideAfter = ref(0)
let step = ref(500)

const theme = inject('theme')
const themeValue = ref(theme.value)
watch(themeValue, (newVal) => {
  theme.value = newVal
})

const onSubmit = () => {
  // console.log(apikey.value, proxy.value)
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
}

onMounted(() => {
  loadConfig();
})

</script>
  
<style></style>
  