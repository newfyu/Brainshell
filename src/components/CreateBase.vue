<template>
  <el-row justify="center"> <el-text><h2>创建新的本地知识库</h2></el-text></el-row>
 
  <el-form label-position="right" label-width="100px">
    <el-form-item label="库名: ">
      <el-input v-model="baseName" placeholder="输入新的库名" />
    </el-form-item>
    <el-form-item label="路径: ">
      <el-input v-model="dirPath" placeholder="输入需要导入的本地文件夹路径">
        <template #append>
          <el-button :icon="FolderAdd" @click="chooseDir"></el-button>
        </template>
      </el-input>
    </el-form-item>
    <el-form-item label="筛选文件类型: ">
      <el-checkbox-group v-model="fileTyep">
        <el-checkbox label="txt" />
        <el-checkbox label="md" />
        <el-checkbox label="pdf" />
        <el-checkbox label="html" />
        <el-checkbox label="docx" />
      </el-checkbox-group>
    </el-form-item>
    <el-form-item label="切片尺寸: ">
      <el-tooltip content="长文本会被切块到小于该尺寸" placement="top" :hide-after="hideAfter">
        <el-input-number v-model="chunkSize" :step="step"/>
      </el-tooltip>
    </el-form-item>
    <el-form-item label="切片重叠: ">
      <el-tooltip content="切片之间重叠的尺寸" placement="top" :hide-after="hideAfter">
        <el-input-number v-model="chunkOverlap" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="最大切片数: ">
      <el-tooltip content="单个文件允许的最多切片数，超过该数会丢弃" placement="top" :hide-after="hideAfter">
        <el-input-number v-model="maxChunk" />
      </el-tooltip>
    </el-form-item>

    <el-form-item>
      <el-button type="primary" v-if="!running" @click="onSubmit">创建</el-button>
      <el-button type="warning" v-if="running"  @click="restartBraindoor">中止</el-button>
    </el-form-item>
  </el-form>
    <el-text v-html="info"></el-text>
</template>
  
<script setup>
import { ref, onMounted } from 'vue'
import { FolderAdd } from '@element-plus/icons-vue'
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { ipcRenderer} from "electron"
let baseName = ref('')
let dirPath = ref('')
let fileTyep = ref([])
let chunkSize = ref(2000)
let chunkOverlap = ref(0)
let maxChunk = ref(10)
let hideAfter = ref(0)
let info = ref('')
let step = ref(500)
let intervalId = null
let running = ref(false)


function chooseDir() {
  const { dialog } = require('electron').remote
  dialog.showOpenDialog({
    properties: ['openDirectory']
  }).then(result => {
    dirPath.value = result.filePaths[0]
  }).catch(err => {
    console.log(err)
  })
}

const onSubmit = () => {
  createBase()
}

function restartBraindoor() {
    ipcRenderer.send('restart-braindoor')
  }

const createBase = () => {
  // 判断baseName, dirPath, fileTyep, chunkSize, chunkOverlap, maxChunk是否为空
  if (baseName.value === '' || dirPath.value === '' || fileTyep.value.length === 0 || chunkSize.value === '' || chunkOverlap.value === '' || maxChunk.value === '') {
    ElMessage({
      message: '请填写完整信息',
      type: 'warning',
    })
    return
  } else {
    running.value = true
    axios.post('http://127.0.0.1:7860/run/create_base', {
      data: [baseName.value, dirPath.value, fileTyep.value, chunkSize.value, chunkOverlap.value, maxChunk.value]
    }).then((response) => {
      info.value = response.data.data[0]
      baseName.value = ''
      dirPath.value = ''
      fileTyep.value = []
      clearInterval(intervalId);
      running.value = false
    }).catch(error => {
      console.error(error);
      running.value = false
    });

    // 请求log
    intervalId = setInterval(() => {
      axios.post('http://127.0.0.1:7860/run/get_log', {
        data: []
      }).then(response => {
        info.value = response['data']['data'][0] // 数组，包含了所有历史记录
      }).catch(error => {
        console.error(error);
      });
    }, 100);
  }


}

onMounted(() => {
})

</script>
  
<style></style>
  