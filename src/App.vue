<script setup>
import axios from 'axios';
import { ref, onMounted } from 'vue';
import { Delete, Lock, ArrowLeft, ArrowRight, DocumentAdd, Stopwatch, CircleCloseFilled } from '@element-plus/icons-vue'
import { ipcRenderer, remote } from "electron"
import Markdown from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/monokai-sublime.css';
import { ElMessage } from 'element-plus'

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

const md2html = () => {
  for (let i = 0; i < QAcontext.value.length; i++) {
    QAcontext.value[i][1] = md.render(QAcontext.value[i][1]);
  }
}


// let test_q = '<a href="file/temp/reference-1.txt" class="asklink" title="Open text snippet 0.218">[1] </a> 写一个vue的<script setup>示例,沙发上地方暗示法发啥呆发啥发水电费安抚沙发舒服asdf阿四饭店啥'
// let test_a = '好的    \n这里是一个简单的Python类\n> 它只有一个属性和一个方法来设置和打印\n> 该属性值:\n\n```python\nclass Person:\n    def __init__(self, name):\n        self.name = name\n    \n    def say_hello(self):\n        print(f"Hello, my name is {self.name}")\n```\n\n在这个例子中,我们定义了一个`Person`类,它具有一个`__init__`方法来设置`name`属性,以及一个`say_hello`方法来打印出该属性的值。\n\n我们可以使用以下代码创建一个`Person`对象,并使用`say_hello`方法打印出其名称:\n\n```python\nperson = Person("Alice")\nperson.say_hello()\n```\n\n这将产生以下输出:\n\n```\nHello, my name is Alice\n```\n\n'
// console.log(test_a)
// test_a = md.render(test_a);
// console.log(test_a)
// let QAcontext = ref([[test_q, test_a]]);
// md2html()


let QAcontext = ref([]);
let scrollbarRef = ref(null);
let itemList = ref(['Item 1', 'Item 2', 'Item 3'])
let caretPosition = ref({ left: 0, top: 0 })
let inputText = ref('')
let inputRef = ref(null)
let showList = ref(false)
const winOffset = 180
let currentWindow = remote.getCurrentWindow();
let defaultBodyHeight = currentWindow.getSize()[1] - winOffset
let bodyHeight = ref(`${defaultBodyHeight}px`)
let intervalId = null
let pageInfo = ref(null)
let streaming = ref(false)
let isLoading = ref(true)
const dragHandle = ref(null);
let isInputFocus = ref(null)
let cancelToken = null
// const tags = ref([
//   { name: 'Tag 1', type: '' },
//   { name: 'Tag 2', type: 'success' },
//   { name: 'Tag 3', type: 'info' },
//   { name: 'Tag 4', type: 'warning' },

// ])
const tags = ref([]);
let isLock = !currentWindow.isResizable()

currentWindow.on('resize', () => {
  bodyHeight.value = `${currentWindow.getSize()[1] - winOffset}px`
  defaultBodyHeight = currentWindow.getSize()[1] - winOffset
})

const sendRequests = () => {
  // 发送总请求
  let question = inputText.value
  if (question) {
    streaming.value = true
    cancelToken = axios.CancelToken.source()
    axios.post('http://127.0.0.1:7860/run/ask', {
      data: [question, "", "", "default", "", "brainshell"]
    }).then(response => {
      QAcontext.value = response['data']['data'][0]
      md2html()
      clearInterval(intervalId); // 停止流式请求
      streaming.value = false
    }).catch(error => {
      console.error(error);
    });
    // 发送流式结果请求
    intervalId = setInterval(() => {
      axios.post('http://127.0.0.1:7860/run/get_ask_stream_answer', {
        data: [question, []]
      }).then(response => {
        QAcontext.value = response['data']['data'][0] // 数组，包含了所有历史记录
        md2html();
        scrollEnd();
      }).catch(error => {
        console.error(error);
      });
    }, 100);
    inputText.value = "";
  } else {
    ElMessage({
      message: '没输入内容啊',
      type: 'warning',
    })
  }
}

const scrollEnd = () => {
  setTimeout(() => {
    scrollbarRef.value.setScrollTop(9999)
  }, 50)
  //滚动到底部
}


// 如果要在任意位置识别# 可能要加键盘响应才行
const handleInput = (event) => {
  const input = inputRef.value.textarea;
  const rect = input.getBoundingClientRect(); // 获得绝对坐标
  const text = event
  const cursorPos = event.length
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
  }, 50)
}

const selectItem = (item) => {
  inputText.value += item;
  showList.value = false;
}

const newPage = () => {
  axios.post('http://127.0.0.1:7860/run/new_page', {
    data: []
  }).then((response) => {
    pageInfo.value = response['data']['data'][6]
    QAcontext.value = ""
  }).catch(error => {
    console.error(error);
  });
  clearInterval(intervalId);
  QAcontext.value = ""
}

const nextPage = () => {
  axios.post('http://127.0.0.1:7860/run/next_page', {
    data: []
  }).then((response) => {
    pageInfo.value = response['data']['data'][5]
    QAcontext.value = response['data']['data'][0]
    md2html()
    scrollEnd()
  }).catch(error => {
    console.error(error);
  });
}

const prevPage = () => {
  axios.post('http://127.0.0.1:7860/run/prev_page', {
    data: []
  }).then((response) => {
    pageInfo.value = response['data']['data'][5]
    QAcontext.value = response['data']['data'][0]
    console.log(response['data']['data'][0])
    md2html()
    // scrollEnd()
  }).catch(error => {
    console.error(error);
  });
}

const delPage = () => {
  axios.post('http://127.0.0.1:7860/run/del_page', {
    data: []
  }).then((response) => {
    pageInfo.value = response['data']['data'][6]
    QAcontext.value = response['data']['data'][0]
    md2html()
    // scrollEnd()
  }).catch(error => {
    console.error(error);
  });
}

const stopRequest = () => {
  axios.post('http://127.0.0.1:7860/run/stop', {
    data: []
  }).then(() => {
    scrollEnd()
  }).catch(error => {
    console.error(error);
  });
  clearInterval(intervalId);
  if (cancelToken) {
    cancelToken.cancel('请求已取消')
    streaming.value = false
  }
}


const lock = () => {
  if (isLock) {
    isLock = false;
  }
  else {
    isLock = true;
  }
  ipcRenderer.send("render2main", "reloadWindow");
}
const textAreaFocus = () => {
  isInputFocus.value = true
}

const textAreaBlur = () => {
  isInputFocus.value = false
}

const toolbarOnHover = () => {
  isLoading.value = false
}

const toolbarOnLeave = () => {
  isLoading.value = true
}


onMounted(() => {
  let win = remote.getCurrentWindow();
  window.addEventListener('mousemove', (event) => {
    let flag = event.target.classList.contains('permeable');
    if (flag && isLock) {
      win.setIgnoreMouseEvents(true, { forward: true });
    }
    else {
      win.setIgnoreMouseEvents(false);
    }
  })
  dragHandle.value = document.getElementById('drag-handle');
  // newPage()
  scrollEnd()

  setTimeout(() => {
    const textareaHeight = parseInt(inputRef.value.textarea.style.height)
    bodyHeight.value = `${parseInt(defaultBodyHeight) + 52 - textareaHeight}px`
  }, 50)
 
})

</script>


///////////////////////////////////


<template>
  <el-row justify="center" align="bottom" class="QAs permeable" :style="{ height: bodyHeight }">
    <el-col :span="24" gutter="10" class="permeable">
      <el-scrollbar class="permeable" ref="scrollbarRef" :max-height="bodyHeight">
        <TransitionGroup tag="div" name="slide">
          <div class="grid-content QA permeable" v-for="(round, index) in QAcontext" :key="index">
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
        </TransitionGroup>
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

      <div class="inputAreaContainer" :class="{ 'InputFocus': isInputFocus }">
        <!-- 如果要shift+enter提交，设置@keydown.shift.enter.prevent -->
        <el-row>
          <el-input id="textArea" v-model.lazy="inputText" @input="handleInput"
            @keydown.enter.exact.prevent="sendRequests" type="textarea" ref="inputRef" maxlength="1000"
            placeholder="请输入内容" resize="none" @focus="textAreaFocus" @blur="textAreaBlur"
            :autosize="{ minRows: 1, maxRows: 5 }" :disabled="streaming">
          </el-input>
        </el-row>


        <el-row class="toolbar">
          <div class="toolbar-inner" id="drag-handle">
            <el-col :span="16" @mouseover="toolbarOnHover" @mouseleave="toolbarOnLeave">
              <el-tooltip content="新建对话页面" placement="top" effect="light">
                <el-button :icon="DocumentAdd" text circle @click="newPage" type="info" :disabled="streaming"
                  v-show="!streaming" />
              </el-tooltip>
              <el-popconfirm title="确定删除页面?" hide-after=0 confirm-button-type="danger" position="top" @confirm="delPage"
                placement="top">
                <template #reference>
                  <el-button :icon="Delete" text circle type="info" :disabled="streaming" v-show="!streaming" />
                </template>
              </el-popconfirm>
              <el-tooltip content="锁定窗口" placement="top" effect="light">
                <el-button :icon="Lock" text circle @click="lock" type="info" :disabled="streaming" v-show="!streaming" />
              </el-tooltip>
              <el-button type="primary" :icon="CircleCloseFilled" :loading-icon="Stopwatch" text :loading="isLoading"
                v-show="streaming" @click="stopRequest">stop</el-button>

            </el-col>
            <el-col :span="8" class="right-align">
              <el-button :icon="ArrowLeft" link circle type="info" @click="nextPage" :disabled="streaming" />
              <el-text size='small' type="info">{{ pageInfo }}</el-text>
              <el-button :icon="ArrowRight" link circle type="info" @click="prevPage" :disabled="streaming" />
            </el-col>
          </div>
        </el-row>
      </div>



    </div>
  </el-footer>
</template>

///////////////////////////////////////

<style src="./style.css"></style>
