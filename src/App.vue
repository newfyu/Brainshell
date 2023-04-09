<script setup>
import axios from 'axios';
import { ref, onMounted } from 'vue';
import { Delete, Refresh, VideoPause, Lock, Pointer } from '@element-plus/icons-vue'
import { ipcRenderer, remote } from "electron"
import Markdown from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/monokai-sublime.css';



const md = Markdown({
  highlight: (str, lang) => {
    const code = lang && hljs.getLanguage(lang)
      ? hljs.highlight(str, {
        language: lang,
        ignoreIllegals: true,
      }).value
      : md.utils.escapeHtml(str);
    return `<pre class="hljs"><code>${code}</code></pre>`;
  },
});


// let test_q = '<a href="file/temp/reference-1.txt" class="asklink" title="Open text snippet 0.218">[1] </a> 写一个vue的<script setup>示例,沙发上地方暗示法发啥呆发啥发水电费安抚沙发舒服asdf阿四饭店啥'
// let test_a = '好的    \n这里是一个简单的Python类\n> 它只有一个属性和一个方法来设置和打印\n> 该属性值:\n\n```python\nclass Person:\n    def __init__(self, name):\n        self.name = name\n    \n    def say_hello(self):\n        print(f"Hello, my name is {self.name}")\n```\n\n在这个例子中,我们定义了一个`Person`类,它具有一个`__init__`方法来设置`name`属性,以及一个`say_hello`方法来打印出该属性的值。\n\n我们可以使用以下代码创建一个`Person`对象,并使用`say_hello`方法打印出其名称:\n\n```python\nperson = Person("Alice")\nperson.say_hello()\n```\n\n这将产生以下输出:\n\n```\nHello, my name is Alice\n```\n\n'


// test_a = md.render(test_a);
// test_q = md.render(test_q);
// let QAcontext = ref([[test_q, test_a], [test_q, test_a]]);

let QAcontext = ref([]);
let scrollbarRef = ref(null);
let itemList = ref(['Item 1', 'Item 2', 'Item 3'])
let caretPosition = ref({ left: 0, top: 0 })
let inputText = ref('')
let inputRef = ref(null)
let showList = ref(false)
let currentWindow = remote.getCurrentWindow();
let defaultBodyHeight = currentWindow.getSize()[1] - 280
let bodyHeight = ref(`${defaultBodyHeight}px`)
let intervalId = null
const dragHandle = ref(null);
const tags = ref([
  { name: 'Tag 1', type: '' },
  { name: 'Tag 2', type: 'success' },
  { name: 'Tag 3', type: 'info' },
  { name: 'Tag 4', type: 'warning' },

])

currentWindow.on('resize', () => {
  bodyHeight.value = `${currentWindow.getSize()[1] - 280}px`
  defaultBodyHeight = currentWindow.getSize()[1] - 280
})



const sendRequests = () => {
  // 发送总请求
  let question = inputText.value
  axios.post('http://127.0.0.1:7860/run/ask', {
    data: [question, "", "", "default", "", "brainshell"]
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


// const preFormat = (text) => {
//   text = text.replace("<", "&lt;"); 
//   text = text.replace(">", "&gt;");
//   return text
// }

const md2html = () => {
  for (let i = 0; i < QAcontext.value.length; i++) {
    // QAcontext.value[i][0] = md.render(QAcontext.value[i][0]); //md转html显示question
    // QAcontext.value[i][0] = `<pre>${preFormat(QAcontext.value[i][0])}</pre>`;
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

  setTimeout(() => {
    const textareaHeight = parseInt(inputRef.value.textarea.style.height)
    bodyHeight.value = `${parseInt(defaultBodyHeight) + 52 - textareaHeight}px`
  }, 100)


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
  //   let win = remote.getCurrentWindow();
  //   window.addEventListener('mousemove', (event) => {
  //   let flag= event.target === document.documentElement;
  //   if (flag) {
  //     win.setIgnoreMouseEvents(true, {forward: true});
  //   }
  //   else {
  //     win.setIgnoreMouseEvents(false);
  //   }
  // win.setIgnoreMouseEvents(true,{forward: true});
  // })
  dragHandle.value = document.getElementById('drag-handle');
  scrollEnd()
})

</script>


///////////////////////////////////




<style>
.QAs {
  /* height: 650px; */
  margin: 15px;

}

.Q {
  text-align: left;
  vertical-align: middle;
  background-color: gray;
  color: white;
  padding-left: 10px;
  padding-right: 10px;
  padding-top: 1px;
  padding-bottom: 1px;
  margin-top: 20px;
}

.A {
  text-align: left;
  vertical-align: middle;
  background-color: CornflowerBlue;
  color: white;
  margin-top: 20px;
  padding-top: 10px;
  padding-bottom: 10px;
  padding-left: 20px;
  padding-right: 20px;
  font-size: small;
}

.QA {
  text-align: right;
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

pre {
  padding: 10px;
  white-space: pre-wrap;
  white-space: -moz-pre-wrap;
  white-space: -webkit-pre-wrap;
  white-space: -o-pre-wrap;
  word-wrap: break-word;
}

.preQ {
  font-size: medium;
}

#textArea {
  border-radius: 0%;
  /* border:1px solid gray; */
}

#drag-handle {
  -webkit-app-region: drag;
}

.mx-1 {
  margin-bottom: 5px;
  margin-right: 5px;
}
</style>


<template>
  <el-row justify="center" align="bottom" class="QAs" ref="chatWindow" :style="{ height: bodyHeight }">
    <el-col :span="24" gutter="10">
      <el-scrollbar ref="scrollbarRef" :max-height="bodyHeight">
        <div class="grid-content QA" v-for="(round, index) in QAcontext" :key="index">
          <div>
            <!-- <div class="Q" v-html="round[0]"></div> -->
            <div class="Q">
              <pre class="preQ">{{ round[0] }}</pre>
            </div>
          </div>
          <div>
            <div class="A" v-html="round[1]"></div>
          </div>
        </div>
      </el-scrollbar>
    </el-col>
  </el-row>
  <el-footer>
    <div id="magicInput">
      <div ref="list" class="mTagList" :style="caretPosition" v-show="showList">
        <ul>
          <li v-for="(item, index) in itemList" :key="index" @click="selectItem(item)">
            {{ item }}
          </li>
        </ul>
      </div>

      <el-tag v-for="tag in tags" :key="tag.name" class="mx-1" closable :type="tag.type" round=true effect="dark"
        size="small">
        {{ tag.name }}
      </el-tag>

      <!-- 如果要shift+enter提交，设置@keydown.shift.enter.prevent -->
      <el-input id="textArea" v-model.lazy="inputText" @input="handleInput" @keydown.enter.exact.prevent="sendRequests"
        type="textarea" ref="inputRef" clearable="true" maxlength="1000" show-word-limit="true" placeholder="请输入内容"
        resize="none" :autosize="{ minRows: 2, maxRows: 5 }">
      </el-input>
      <el-row class="toolbar">
        <el-button class="toolButton" :icon="Refresh" text="true" bg="true" circle @click="clearContext" />
        <el-button class="toolButton" :icon="Delete" text="true" bg="true" circle />
        <el-button class="toolButton" :icon="VideoPause" text="true" bg="true" circle />
        <el-button class="toolButton" :icon="Lock" text="true" bg="true" circle @click="lock" />
        <el-button id="drag-handle" :icon="Pointer" text="true" bg="true" circle />
      </el-row>
    </div>
  </el-footer>
</template>

///////////////////////////////////////