<template>
  <el-form label-position="right" label-width="80px">
    <el-form-item label="API key: ">
      <el-input v-model="apikey" placeholder="输入OpenAI的API key" />
    </el-form-item>
    <el-form-item label="Proxy: ">
      <el-input v-model="proxy" placeholder="输入代理地址" />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="onSubmit">保存</el-button>
    </el-form-item>
  </el-form>
</template>
  
<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios';
let apikey = ref('')
let proxy = ref('')

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
  }).catch(error => {
    console.error(`load config 失败： ${error.message}`);
  });
}

const saveConfig = () => {
  axios.post('http://127.0.0.1:7860/run/save_config_from_brainshell', {
      data: [apikey.value, proxy.value]
    }).then(() => {
    }).catch(error => {
      console.error(error);
    });
  }

onMounted(() => {
  loadConfig()
})

</script>
  
<style>
</style>
  