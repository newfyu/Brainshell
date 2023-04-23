<script setup>
import axios from 'axios';
import { ref, onMounted } from 'vue';
import { Delete, Lock, ArrowLeft, ArrowRight, DocumentAdd, Stopwatch, CircleCloseFilled } from '@element-plus/icons-vue'
import { ipcRenderer, remote } from "electron"
import Markdown from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/monokai-sublime.css';
import { ElMessage } from 'element-plus';
import pinyin from "pinyin";

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
let inputText = ref('')
let tagBoxRef = ref(null)
let currentWindow = remote.getCurrentWindow();
let isLock = !currentWindow.isResizable()
let winOffset = 0
if (isLock) {
  winOffset = 30
}
if (!isLock) {
  QAcontext.value = [['正在连接braindoor……', '']];
}

// let defaultBodyHeight = currentWindow.getSize()[1] - parseInt((currentWindow.getSize()[1] + 1700) / 12) + winOffset -40
let defaultBodyHeight = currentWindow.getSize()[1] - 180 + winOffset
let bodyHeight = ref(`${defaultBodyHeight}px`)

const adjustHeight = () => {
  let tagHeight = 0
  if (tagBoxRef.value || tagBoxRef.value.getBoundingClientRect().height != 0) {
    tagHeight = tagBoxRef.value.getBoundingClientRect().height - 20
  }
  // defaultBodyHeight = currentWindow.getSize()[1] - parseInt((currentWindow.getSize()[1] + 1700) / 12) + winOffset - 40
  defaultBodyHeight = currentWindow.getSize()[1] - 180 + winOffset - tagHeight
  bodyHeight.value = `${defaultBodyHeight}px`
}


let intervalId = null
let pageInfo = ref(null)
let streaming = ref(false)
let isLoading = ref(true)
const dragHandle = ref(null);
let isInputFocus = ref(null)
let cancelToken = null
const tagColor = {
  base: 'warning',
  prompt: 'primary',
  option: 'success',
  agent: 'danger'
}
let tabList = ref([
  { name: 'Item 1', type: 'base' },
  { name: '翻译', type: 'prompt' },
  { name: 'Item 3', type: 'agent' },
  { name: 'Item 4', type: 'option' },
])
let caretPosition = { left: 0, top: 0 };
let content = '';
let listRef = ref(null)
let inputRef = ref(null)
let showList = ref(false)
let inputTags = ref([])



currentWindow.on('resize', () => {
  adjustHeight();
})


const sendRequests = () => {
  // 发送总请求
  let question = inputText.value
  if (question) {
    streaming.value = true
    cancelToken = axios.CancelToken.source()
    const tagStr = tag2str()
    question = question + tagStr
    axios.post('http://127.0.0.1:7860/run/ask', {
      data: [question, "", "", "default", "", "brainshell"]
    }).then(response => {
      clearInterval(intervalId); // 停止流式请求
      streaming.value = false
      inputRef.value.focus()
      setTimeout(() => {
        QAcontext.value = response['data']['data'][0]
        md2html()
      }, 100);
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
    adjustHeight();
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

ipcRenderer.on('message-from-main', (event, arg) => {
  console.log(arg); // 打印从主进程接收到的消息
  if (arg === 'blurLongTime') {
    newPage();
  }
});

// let retryId = null; // setInterval 返回的 id
let retryCount = 0; // 当前已重试的次数


// 启动后尝试与braindoor进行连接
const contactBrainoor = () => {
  axios.post('http://127.0.0.1:7860/run/new_page', {
    data: []
  }).then((response) => {
    pageInfo.value = response['data']['data'][6]
    const arr = response['data']['data'][7]['data']
    tabList.value = arr.map(([name, type]) => ({ name, type }));

    tabList.value = tabList.value.map(item => {
      return {
        ...item, color: tagColor[item.type], abbr: '/' + textAbbr(item.name)
      }
    })


    if (!isLock) {
      QAcontext.value = [['正在连接大脑门……', '<div style="margin-top:8px;margin-bottom:8px">连接成功,可以对话了。</div>']];
      // clearInterval(retryId);
    }
  }).catch(error => {
    console.error(`连接braindoor错误： ${error.message}`);
    retry();
  });

}

const retry = () => {
  retryCount++;
  console.log(`正在进行第 ${retryCount} 次重试`);
  if (retryCount === 60) {
    console.error('无法连接braindoor，打开127.0.0.1:7860查看配置是否正确');
    // clearInterval(retryId);
    return;
  }
  // 按照设定的间隔再次发送请求
  // retryId = setInterval(contactBrainoor, 3000);
  setTimeout(() => {
    contactBrainoor();
  }, 3000)
}

function setState() {
  let rect = currentWindow.getBounds();
  let obj = { rect }
  localStorage.setItem('winState', JSON.stringify(obj));
}

function getState() {
  let winState = localStorage.getItem('winState');
  winState = JSON.parse(winState);
  currentWindow.setBounds(winState.rect);
}

function debounce(fn) {
  let timeout = null;
  return function () {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn.apply(this, arguments);
    }, 500);
  }
}



const handleInput = () => {
  // console.log(tagBoxRef.value.getBoundingClientRect().height)
}


const handleTagClose = (tag) => {
  inputTags.value.splice(inputTags.value.indexOf(tag), 1)
  setTimeout(() => {
    adjustHeight()
  }, 50)
}

function tag2str() {
  if (inputTags.value.length > 0) {
    let tagStrings = inputTags.value.map(tag => '#' + tag.name);
    let result = tagStrings.join(' ');
    result = "\n " + result
    return result;
  } else {
    return ''
  }

}

function selectItem(item) {
  // inputRef.value.focus(); // return focus to input area
  const textarea = inputRef.value.textarea
  const position = inputRef.value.textarea.selectionEnd
  inputTags.value.push({ name: item.name, type: item.type, color: tagColor[item.type] })

  let text = textarea.value;
  textarea.value = text.substring(0, position - 1) + text.substring(position);
  textarea.selectionStart = position - 1;
  textarea.selectionEnd = position - 1;

  setTimeout(() => {
    adjustHeight()
  }, 50)
}

function cancel() {
  caretPosition = {
    display: "none"
  }
  showList.value = false;
  content = content.slice(0, -1);
}

function onKeyDown(event) {
  const key = event.key;
  if (showList.value) {
    if ((key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight' || key === "Enter")) {
      event.preventDefault(); // prevent scrolling
      const itemList = listRef.value.querySelectorAll('li');
      let selectedIndex = -1;
      for (let i = 0; i < itemList.length; i++) {
        if (itemList[i].classList.contains('selected')) {
          selectedIndex = i;
          break;
        }
      }
      if (key === 'ArrowUp' && selectedIndex > 0) {
        itemList[selectedIndex].classList.remove('selected');
        itemList[selectedIndex - 1].classList.add('selected');
      } else if (key === 'ArrowDown' && selectedIndex < itemList.length - 1) {
        if (selectedIndex >= 0) {
          itemList[selectedIndex].classList.remove('selected');
        }
        itemList[selectedIndex + 1].classList.add('selected');
      }
      if (key === 'Enter') {
        event.preventDefault()
        const itemList = listRef.value.querySelectorAll('li');
        for (let i = 0; i < itemList.length; i++) {
          if (itemList[i].classList.contains('selected')) {
            selectItem(tabList.value[i]);
            break;
          }
        }
        setTimeout(() => {
          caretPosition = { display: "none" }
          showList.value = false;
        }, 50)
      }
    } else if (key === 'Escape') {
      cancel()
    } // 最后else,输入其他数字的时候，在tablist中查询
  } else { // 输入文字模式
    if (key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendRequests()
    }
    if (key === '/') {
      caretPosition = {
        display: "flex"
      }
      showList.value = true;
    }
  }
}

// 把输入的文字转换成拼音首字母缩写
function textAbbr(text) {
  const pinyinArr = pinyin(text, {
    style: pinyin.STYLE_FIRST_LETTER
  });
  let result = pinyinArr.join('');
  if (result.length > 4) {
    result = result.slice(0, 4);
  }
  return result;
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

  win.on('move', debounce(() => {
    setState();
  }))

  win.on('resize', debounce(() => {
    setState();
  }))

  dragHandle.value = document.getElementById('drag-handle');
  contactBrainoor();
  setTimeout(() => {
    adjustHeight();
  }, 50)
  getState();
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


  <el-footer class="footer">
    <div id="magicInput">
      <div ref="listRef" class="popList" :style="caretPosition" v-show="showList">
        <ul>
          <li v-for="(item, index) in tabList" :key="index" @click="selectItem(item)" class="tab-item">
            <el-text :type="item.color">
              {{ item.abbr }}  {{ item.name }} ({{ item.type }})
            </el-text>
          </li>
        </ul>
      </div>
      <div class="tagBox" ref="tagBoxRef">
        <el-tag v-for="tag in inputTags" :key="tag" class="etag" closable round size="small" :type="tag.color"
          effect="dark" :disable-transitions="true" @close="handleTagClose(tag)">
          {{ tag.name }}
        </el-tag>
      </div>
      <div class="inputAreaContainer" :class="{ 'InputFocus': isInputFocus }">
        <!-- 如果要shift+enter提交，设置@keydown.shift.enter.prevent -->
        <el-row>
          <el-input id="textArea" v-model.lazy="inputText" @input="handleInput" type="textarea" ref="inputRef"
            maxlength="2000" placeholder="请输入内容" resize="none" @focus="textAreaFocus" @blur="textAreaBlur"
            :autosize="{ minRows: 1, maxRows: 8 }" :disabled="streaming" @keydown="onKeyDown">
          </el-input>
        </el-row>


        <el-row class="toolbar">
          <div class="toolbar-inner" id="drag-handle">
            <el-col :span="16" @mouseover="toolbarOnHover" @mouseleave="toolbarOnLeave">

              <!-- <el-tooltip content="新建对话页面" placement="top" effect="light"> -->
              <Transition name="fade">
                <el-button :icon="DocumentAdd" text circle @click="newPage" type="info" :disabled="streaming"
                  v-show="!streaming" />
              </Transition>
              <!-- </el-tooltip> -->

              <el-popconfirm title="确定删除页面?" hide-after=0 confirm-button-type="danger" position="top" @confirm="delPage"
                placement="top">
                <template #reference>
                  <Transition name="fade">
                    <el-button :icon="Delete" text circle type="info" :disabled="streaming" v-show="!streaming" />
                  </Transition>
                </template>
              </el-popconfirm>
              <!-- <el-tooltip content="锁定窗口" placement="top" effect="light"> -->
              <Transition name="fade">
                <el-button :icon="Lock" text circle @click="lock" type="info" :disabled="streaming" v-show="!streaming" />
              </Transition>
              <!-- </el-tooltip> -->
              <Transition name="fade">
                <el-button type="primary" :icon="CircleCloseFilled" :loading-icon="Stopwatch" text :loading="isLoading"
                  v-show="streaming" @click="stopRequest">stop</el-button>
              </Transition>
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
