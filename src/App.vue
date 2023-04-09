<script setup>
import axios from 'axios';
import { ref, onMounted } from 'vue';
import { Delete, Refresh, VideoPause, Lock } from '@element-plus/icons-vue'
import { ipcRenderer, remote } from "electron"
import Markdown from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/monokai-sublime.css';


let test_a = '好的,这里是一个简单的Python类,它只有一个属性和一个方法来设置和打印该属性值:\n\n```python\nclass Person:\n    def __init__(self, name):\n        self.name = name\n    \n    def say_hello(self):\n        print(f"Hello, my name is {self.name}")\n```\n\n在这个例子中,我们定义了一个`Person`类,它具有一个`__init__`方法来设置`name`属性,以及一个`say_hello`方法来打印出该属性的值。\n\n我们可以使用以下代码创建一个`Person`对象,并使用`say_hello`方法打印出其名称:\n\n```python\nperson = Person("Alice")\nperson.say_hello()\n```\n\n这将产生以下输出:\n\n```\nHello, my name is Alice\n```\n\n'
let test_q = '<xmp>写一个vue的<script>示例'
const md = Markdown({
  highlight: (str,lang) => {
    const code = lang && hljs.getLanguage(lang)
      ? hljs.highlight(str, {
          language: lang,
          ignoreIllegals: true,
        }).value
      : md.utils.escapeHtml(str);
    return `<pre class="hljs"><code>${code}</code></pre>`;
  },
});
test_a = md.render(test_a);
test_q = md.render(test_q);
let QAcontext = ref([[test_q,test_a]]);

// let QAcontext = ref([]);
let scrollbarRef = ref(null);
let itemList = ref(['Item 1', 'Item 2', 'Item 3'])
let caretPosition = ref({ left: 0, top: 0 })
let inputText = ref('')
let inputRef = ref(null)
let showList = ref(false)

let currentWindow = remote.getCurrentWindow();
let defaultBodyHeight = currentWindow.getSize()[1] - 300
let bodyHeight = ref(`${defaultBodyHeight}px`)
currentWindow.on('resize', () => {
  bodyHeight.value = currentWindow.getSize()[1] - 300
})



let intervalId = null
const sendRequests = () => {
  // 发送总请求
  let question = inputText.value

  axios.post('http://127.0.0.1:7860/run/ask', {
    data: [question, "","", "default", "","brainshell"]
  }).then(response => {
    QAcontext.value = response['data']['data'][0]
    md2html()
    clearInterval(intervalId); // 停止流式请求
  }).catch(error => {
    console.error(error);
  });
  // 发送流式结果请求
  intervalId = setInterval(() => {
    axios.post('http://127.0.0.1:7860/run/get_ask_stream_answer', {
      data: [question, []]
    }).then(response => {
      QAcontext.value = response['data']['data'][0] // 数组，包含了所有历史记录
      scrollEnd();
      md2html();
    }).catch(error => {
      console.error(error);
    });
  }, 100);
  inputText.value = "";
}

const scrollEnd = () => {
  scrollbarRef.value.setScrollTop(9999) //滚动到底部
}

const md2html = () => {
  for (let i = 0; i < QAcontext.value.length; i++) {
    // QAcontext.value[i][0] = md.render(QAcontext.value[i][0]);
    QAcontext.value[i][0] = `<xmp>${QAcontext.value[i][0]}`;
    QAcontext.value[i][1] = md.render(QAcontext.value[i][1]);
  }
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

  setTimeout(()=>{
    const textareaHeight = parseInt(inputRef.value.textarea.style.height)
    bodyHeight.value = `${parseInt(defaultBodyHeight) + 31 - textareaHeight}px`
  },100)

  
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
  clearInterval(intervalId);
  // remote.getCurrentWindow().hide();
  QAcontext.value = ""
  // remote.getCurrentWindow().show();

}


const lock = () => {
    ipcRenderer.send("render2main", "reloadWindow");
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
pre {
  padding:10px;
  white-space: pre-wrap;			/* 保留空白符序列，并正常进行换行 */
  white-space: -moz-pre-wrap;		/* 兼容火狐浏览器 */
  white-space: -webkit-pre-wrap;	/* 兼容谷歌浏览器 */
  white-space: -o-pre-wrap;			/* 兼容opera浏览器 */
  word-wrap: break-word;			/* 允许字母、url地址换行 */
}

</style>


<template>

  <el-row justify="center" align="bottom" class="QAs" ref="chatWindow" :style="{height:bodyHight}">
    <el-col :span="24" gutter="10">
      <el-scrollbar ref="scrollbarRef" :max-height="bodyHeight">
        <div class="grid-content ep-bg-purple-dark QA" v-for="(round, index) in QAcontext" :key="index">
          <div>
            <!-- <div class="Q">{{ once[0] }}</div> -->
            <div class="Q" v-html="round[0]"></div>
          </div>
          <div>
            <div class="A" v-html="round[1]"></div>
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
    <el-input v-model.lazy="inputText" @input="handleInput" @keydown.shift.enter.prevent="sendRequests"
      @change="handleChange" type="textarea" ref="inputRef" clearable="true" maxlength="1000" show-word-limit="true"
      placeholder="请输入内容" resize="none" :autosize="{ minRows: 2, maxRows: 5 }">
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