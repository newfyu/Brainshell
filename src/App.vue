<script setup>
import axios from 'axios';
import { ref, onMounted } from 'vue';
import { Delete, Refresh, VideoPause, Lock } from '@element-plus/icons-vue'
import { ipcRenderer } from "electron"

let QAcontext = ref([['你好','测试']]);
let scrollbarRef = ref(null);
let itemList = ref(['Item 1', 'Item 2', 'Item 3'])
let caretPosition = ref({ left: 0, top: 0 })
let inputText = ref('')
let inputRef = ref(null)
let showList = ref(false)

const defaultBodyHeight = '700'
let bodyHeight = ref(`${defaultBodyHeight}px`)

const sendRequests = () => {
  // 发送总请求
  let question = inputText.value

  axios.post('http://127.0.0.1:7860/run/ask', {
    data: [question, "", "default", ""]
  }).then(response => {
    QAcontext.value = response['data']['data'][0]
    clearInterval(intervalId); // 停止流式请求
  }).catch(error => {
    console.error(error);
  });

  // 发送流式结果请求
  const intervalId = setInterval(() => {
    axios.post('http://127.0.0.1:7860/run/get_ask_stream_answer', {
      data: [question, []]
    }).then(response => {
      QAcontext.value = response['data']['data'][0] // 数组，包含了所有历史记录
      scrollEnd();
    }).catch(error => {
      console.error(error);
    });
  }, 100);
  inputText.value = "";

}

const scrollEnd = () => {
  scrollbarRef.value.setScrollTop(9999) //滚动到底部
}

// 如果要在任意位置识别# 可能要加键盘响应才行
const handleInput = (event) => {
  const input = inputRef.value.textarea;
  const rect = input.getBoundingClientRect(); // 获得绝对坐标
  const text = event
  // console.log(event)
  const cursorPos = event.length
  // console.log(rect)
  caretPosition.value = {
    left: `${rect.x + cursorPos * 8}px`, // TODO 还要考虑换行什么的，要精确计算一下
    top: `${rect.top - 100}px`,  // TODO 这个100应该是mtagList的高度，mTagList以后要设置一下
    color: 'red',
    zIndex: 9999,
  }
  // console.log(caretPosition.value.top)
  if (text[cursorPos - 1] === '#') {
    showList.value = true;
  } else {
    showList.value = false;
  }

  
}

const handleChange = () => {
  console.log("change")
}

const selectItem = (item) => {
  inputText.value += item;
  showList.value = false;
}

const clearContext = () => {
  axios.post('http://127.0.0.1:7860/run/clear_context', {
    data: []
  }).then(() => {
    QAcontext.value = ""
  }).catch(error => {
    console.error(error);
  });
  // remote.getCurrentWindow().hide();
  QAcontext.value = ""
  // remote.getCurrentWindow().show();

}


const lock = () => {
    ipcRenderer.send("render2main", "reloadWindow");
}

const handleKeyDown = (event) => {
  console.log(event)
  if (event.shiftKey && event.keyCode === 13){
    sendRequests();
  }
  setTimeout(()=>{
    const footHeight = parseInt(inputRef.value.textarea.style.height)
    bodyHeight.value = `${parseInt(defaultBodyHeight) + 31 - footHeight}px`
  },100)

  }

onMounted(() => {
  scrollEnd()
})

</script>


///////////////////////////////////




<style>
.grid-content {
  border-radius: 4px;
  min-height: 36px;
  /* background-color: bisque; */
  margin: 10px;
}

.Q {
  /* display: inline-block; */
  text-align: left;
  vertical-align: middle;
  background-color: gray;
  padding: 20px;
  color: white;
}

.A {
  /* display: inline-block; */
  text-align: left;
  vertical-align: middle;
  background-color: CornflowerBlue;
  color: white;
  margin-top: 20px;
  padding: 20px;
}

.QA {
  text-align: right;
}
.QAs {
  height:650px;
}

.mTagList {
  position: absolute;
  background-color: white;
  border: 1px solid gray;
  max-height: 150px;
  overflow-y: auto;
}

.toolbar {
  padding: 5px;
}

.el-button.is-text:not(.is-disabled).is-has-bg {
  background-color: unset;
}


.magicInput {
  flex-grow: 0;
  height: 50px;
}

.mainContainer {
  display: flex;
  flex-direction: column;
  height: 700px;
}

</style>


<template>
  <el-row justify="center" align="bottom" class="QAs" ref="chatWindow" :style="{height:bodyHeight}">
    <el-col :span="24" gutter="10">
      <el-scrollbar ref="scrollbarRef" max-height="650px">
        <div class="grid-content ep-bg-purple-dark QA" v-for="(once, index) in QAcontext" :key="index">
          <div>
            <div class="Q">{{ once[0] }}</div>
          </div>
          <div>
            <div class="A">{{ once[1] }}</div>
          </div>
        </div>
      </el-scrollbar>
    </el-col>
  </el-row>
  <br>
  <el-footer>
  <div id="magicInput">
    <div ref="list" class="mTagList" :style="caretPosition" v-show="showList">
      <ul>
        <li v-for="(item, index) in itemList" :key="index" @click="selectItem(item)">
          {{ item }}
        </li>
      </ul>
    </div>
    <!-- <textarea v-model="inputText" @input="handleInput" ref="inputRef"></textarea> -->
    <el-input v-model.lazy="inputText" @input="handleInput" @keydown="handleKeyDown"
      @change="handleChange" type="textarea" ref="inputRef" clearable="true" maxlength="1000" show-word-limit="true"
      placeholder="请输入内容" resize="none" :autosize="{ minRows: 1, maxRows: 5 }">
    </el-input>
    <el-row class="toolbar">
      <el-button :icon="Refresh" text="true" bg="true" circle @click="clearContext" />
      <el-button :icon="Delete" text="true" bg="true" circle />
      <el-button :icon="VideoPause" text="true" bg="true" circle />
      <el-button :icon="Lock" text="true" bg="true" circle @click="lock" />
    </el-row>
  </div>
  </el-footer>
</template>

///////////////////////////////////////