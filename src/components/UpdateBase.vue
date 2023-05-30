<template>
  <el-row justify="center">
    <el-text>
      <h2>更新本地知识库</h2>
    </el-text>
  </el-row>
  <el-row justify="center">
    <el-select v-model="baseName" placeholder="选择本地知识库" @change="getBaseInfo">
      <el-option v-for="item in baseList" :key="item.value" :label="item.label" :value="item.value" />
    </el-select>
  </el-row>
  <br>
  <el-row justify="center" v-if="baseName">
    <el-button type="primary">更新</el-button>
    <el-button @click="showEdit = true">编辑</el-button>
  </el-row>

  <el-form label-position="right" label-width="100px" v-if="showEdit">
    <el-divider />
    <el-row justify="center"> <el-text>
        <h2>编辑本地知识库</h2>
      </el-text></el-row>
    <el-form-item label="切片尺寸: ">
      <el-tooltip content="长文本会被切块到小于该尺寸" placement="right" :hide-after="hideAfter">
        <el-input-number v-model="chunkSize" :step="step" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="切片重叠: ">
      <el-tooltip content="切片之间重叠的尺寸" placement="right" :hide-after="hideAfter">
        <el-input-number v-model="chunkOverlap" />
      </el-tooltip>
    </el-form-item>
    <el-form-item label="最大切片数: ">
      <el-tooltip content="单个文件允许的最多切片数，超过该数会丢弃" placement="right" :hide-after="hideAfter">
        <el-input-number v-model="maxChunk" />
      </el-tooltip>
    </el-form-item>

    <el-card class="box-card">
    <el-table :data="dirData" style="width: 100%" stripe highlight-current-row>
      <el-table-column prop="path" label="索引文件夹：" width="1000"/>
    </el-table>
  
    <br>
    <el-form-item label="增加文件夹: ">
      <el-input v-model="dirPath" placeholder="输入需要导入的本地文件夹路径">
        <template #append>
          <el-button :icon="FolderAdd" @click="chooseDir"></el-button>
        </template>
      </el-input>
    </el-form-item>
    <el-form-item label="文件类型: ">
      <el-checkbox-group v-model="fileTyep">
        <el-checkbox label="txt" />
        <el-checkbox label="md" />
        <el-checkbox label="pdf" />
        <el-checkbox label="html" />
        <el-checkbox label="docx" />
      </el-checkbox-group>
    </el-form-item>
    </el-card>

    <br>
    <el-row justify="center">
      <el-button type="primary" v-if="!running" @click="onSubmit">保存</el-button>
      <el-button v-if="!running" @click="onSubmit">取消</el-button>
      <el-button type="warning" v-if="running" @click="restartBraindoor">中止</el-button>
    </el-row>
  </el-form>

  <el-text v-html="info"></el-text>
</template>
  
<script setup>
import { ref, onMounted } from 'vue'
import { FolderAdd } from '@element-plus/icons-vue'
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { ipcRenderer } from "electron"
let baseName = ref('')
let dirPath = ref([])
let dirData = ref([])
let fileTyep = ref([])
let chunkSize = ref(null)
let chunkOverlap = ref(null)
let maxChunk = ref(null)
let hideAfter = ref(0)
let showEdit = ref(false)
let info = ref('')
let step = ref(500)
let intervalId = null
let running = ref(false)

const baseList = ref([])


const getBaseInfo = () => {
  axios.post('http://127.0.0.1:7860/run/get_base_info', {
    data: [baseName.value]
  }).then((response) => {
    chunkSize.value = response.data.data[0]
    chunkOverlap.value = response.data.data[1]
    maxChunk.value = response.data.data[2]

    //把dirData的值改为response.data.data[3].choices的值存入dirData,格式是[{path:value},{path:value}...]
    dirData.value = response.data.data[3].choices.map((item) => {
      return {
        path: item
      }
    })
    

    console.log(dirData.value)
  }).catch(error => {
    console.error(error);
  });
}


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
  axios.post('http://127.0.0.1:7860/run/get_base_list', {
    data: []
  }).then((response) => {
    for (let i = 0; i < response.data.data[0].choices.length; i++) {
      baseList.value.push({ value: response.data.data[0].choices[i], label: response.data.data[0].choices[i] })
    }
  }).catch(error => {
    console.error(error);
  });
})

</script>
  
<style></style>
  