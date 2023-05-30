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
    <el-button v-if="!running" @click="updateBase" type="primary">更新</el-button>
    <el-button v-if="!running" @click="showEdit = true">编辑</el-button>
    <el-button type="warning" v-if="running" @click="restartBraindoor">中止</el-button>
  </el-row>

  <el-form label-position="right" label-width="100px" v-if="showEdit">
    <el-divider />
    <el-row justify="center"> <el-text>
        <h2>{{ baseName }}</h2>
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
        <el-table-column prop="path" label="索引文件夹：" width="400" />
        <el-table-column fixed="left" label="删除" width="60">
          <template #default="scope">
            <el-button link type="danger" :icon="Remove" @click.prevent="deleteRow(scope.$index)" />
          </template>
        </el-table-column>
      </el-table>

      <br>
      <el-form-item label="增加文件夹: ">
        <el-input v-model="dirPath" placeholder="新导入的本地文件夹路径">
          <template #append>
            <el-button :icon="FolderAdd" @click="chooseDir"></el-button>
          </template>
        </el-input>

      </el-form-item>
      <el-form-item label="文件类型: ">
        <el-checkbox-group v-model="fileType">
          <el-checkbox label="txt" />
          <el-checkbox label="md" />
          <el-checkbox label="pdf" />
          <el-checkbox label="html" />
          <el-checkbox label="docx" />
        </el-checkbox-group>


      </el-form-item>
      <el-row justify="center">
        <el-button @click="AddItem">添加文件夹</el-button>
      </el-row>
    </el-card>

    <br>
    <el-row justify="center">
      <el-button type="primary" v-if="!running" @click="SaveBaseConfig">保存</el-button>
      <el-button v-if="!running" @click="showEdit=false">取消</el-button>

    </el-row>
  </el-form>
  <el-divider v-if="running" />
  <el-text v-if="running" v-html="info"></el-text>
</template>
  
<script setup>
import { ref, onMounted } from 'vue'
import { FolderAdd, Remove } from '@element-plus/icons-vue'
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { ipcRenderer } from "electron"
let baseName = ref('')
let dirPath = ref([])
let dirData = ref([])
let fileType = ref([])
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

const deleteRow = (index) => {
  console.log(dirData.value[index]['path'])
  let path = dirData.value[index]['path'].split(':')[0]
  axios.post('http://127.0.0.1:7860/run/remove_dir', {
    data: ["", path]
  }).then(() => {
    dirData.value.splice(index, 1)
  }).catch(error => {
    console.error(error);
  });
}

const getBaseInfo = () => {
  axios.post('http://127.0.0.1:7860/run/get_base_info', {
    data: [baseName.value]
  }).then((response) => {
    chunkSize.value = response.data.data[0]
    chunkOverlap.value = response.data.data[1]
    maxChunk.value = response.data.data[2]
    dirData.value = response.data.data[3].choices.map((item) => {
      return {
        path: item
      }
    })
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

function restartBraindoor() {
  ipcRenderer.send('restart-braindoor')
}

const updateBase = () => {
  running.value = true
  showEdit.value = false
  axios.post('http://127.0.0.1:7860/run/update_base', {
    data: [baseName.value]
  }).then((response) => {
    info.value = response.data.data[0]
    clearInterval(intervalId);
    running.value = false
    ElMessage({ message: '更新成功', type: 'success', })
  }).catch(error => {
    console.error(error);
    running.value = false
  });
  // 请求log
  intervalId = setInterval(() => {
    axios.post('http://127.0.0.1:7860/run/get_log', {
      data: []
    }).then(response => {
      info.value = response['data']['data'][0]
    }).catch(error => {
      console.error(error);
    });
  }, 100);

}

const AddItem = () => {
  if (dirPath.value === '') {
    ElMessage({ message: '文件夹路径不能为空', type: 'error', })
    return
  }
  if (fileType.value.length === 0) {
    ElMessage({ message: '文件类型不能为空', type: 'error', })
    return
  }

  let newPath = dirPath.value + ':' + fileType.value.join('|')
  dirData.value.push({
    path: newPath,
  })
  
  axios.post('http://127.0.0.1:7860/run/add_dir', {
    data: ["", dirPath.value, fileType.value]
  }).then(() => {
  }).catch(error => {
    console.error(error);
  });
}

const SaveBaseConfig = () => {
  axios.post('http://127.0.0.1:7860/run/save_base_config', {
    data: [baseName.value, chunkSize.value, chunkOverlap.value, maxChunk.value, ""]
  }).then(() => {
    ElMessage({ message: '保存成功', type: 'success', })
  }).catch(error => {
    console.error(error);
  });
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
  