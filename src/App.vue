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


let QAcontext = ref([]); // 所有的问答对历史
let scrollbarRef = ref(null); // 滚动条的ref，控制滚动
let inputText = ref('')  // 主输入框的内容
let tagBoxRef = ref(null)  // 标签框的ref，用于控制高度
let currentWindow = remote.getCurrentWindow(); // 当前窗口
let isLock = !currentWindow.isResizable() // 是否锁定窗口
let winOffset = 0 // 窗口偏移量，用于微调一些组件的位置
if (isLock) {
  winOffset = 30
}
if (!isLock) {
  QAcontext.value = [['正在连接braindoor……', '']];
}

// let defaultBodyHeight = currentWindow.getSize()[1] - parseInt((currentWindow.getSize()[1] + 1700) / 12) + winOffset -40
let defaultBodyHeight = currentWindow.getSize()[1] - 180 + winOffset // 默认的聊天显示框高度
let bodyHeight = ref(`${defaultBodyHeight}px`)
let retryCount = 0; // 当前已重试的次数

const adjustHeight = () => {
  let tagHeight = 0
  if (tagBoxRef.value || tagBoxRef.value.getBoundingClientRect().height != 0) {
    tagHeight = tagBoxRef.value.getBoundingClientRect().height - 20
  }
  // defaultBodyHeight = currentWindow.getSize()[1] - parseInt((currentWindow.getSize()[1] + 1700) / 12) + winOffset - 40
  defaultBodyHeight = currentWindow.getSize()[1] - 180 + winOffset - tagHeight
  bodyHeight.value = `${defaultBodyHeight}px`
}

let intervalId = null // 流式请求的定时器id
let pageInfo = ref(null) // 页码信息
let streaming = ref(false) // 是否正在流式请求
let isLoading = ref(true) // 是否正在加载，控制是否可以输入和使用工具按钮
const dragHandle = ref(null); // 拖动窗口的句柄
let isInputFocus = ref(null)
let cancelToken = null
const tagColor = { // 根据etag的类型设定标签颜色
  base: 'warning',
  prompt: 'primary',
  option: 'success',
  agent: 'danger',
}
let tagList = ref([
  { name: 'Item 1', type: 'base' },
  { name: '翻译', type: 'prompt' },
  { name: 'Item 3', type: 'agent' },
  { name: 'Item 4', type: 'option' },
])
let tagListCache = []
let caretPosition = { left: 0, top: 0 };
let listRef = ref(null)
let inputRef = ref(null)
let showList = ref(false)
let inputTags = ref([])
let tagQuery = "/"


currentWindow.on('resize', () => {
  adjustHeight();
})

// 提交text
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

// 滚动到底部
const scrollEnd = () => {
  setTimeout(() => {
    scrollbarRef.value.setScrollTop(9999)
  }, 50)
  //滚动到底部
}

// 新建页面
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

// 按下下一页按钮时，获取下一页的内容
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

// 按下前一页按钮时，获取上一页的内容
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

// 删除当前对话页面
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

// 强行中断请求
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

// locak模式切换，向主进程发送消息，主进程收到消息后重载窗口
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

// 监听主进程发送的消息,一定时间内没有输入则触发隐藏，目前作废
ipcRenderer.on('message-from-main', (event, arg) => {
  console.log(arg); // 打印从主进程接收到的消息
  if (arg === 'blurLongTime') {
    newPage();
  }
});

// 启动后尝试与braindoor进行连接
const contactBrainoor = () => {
  axios.post('http://127.0.0.1:7860/run/new_page', {
    data: []
  }).then((response) => {
    if (!isLock) {
      QAcontext.value = [['正在连接大脑门……', '连接成功，可以对话了  \n`shift-enter`换行  \n`/`键选择扩展标签']];
      md2html();
    }
    pageInfo.value = response['data']['data'][6]
    const arr = response['data']['data'][7]['data']
    tagList.value = arr.map(([name, type]) => ({ name, type }));

    tagList.value = tagList.value.map(item => {
      return {
        ...item, color: tagColor[item.type], abbr: '/' + textAbbr(item.name)
      }
    })
    tagListCache = tagList.value.slice();

    
  }).catch(error => {
    console.error(`连接braindoor错误： ${error.message}`);
    retry();
  });

}

// 重试函数,用于contactBrainoor失败时重试
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

// 储存窗口状态
function setState() {
  let rect = currentWindow.getBounds();
  let obj = { rect }
  localStorage.setItem('winState', JSON.stringify(obj));
}

// 获得储存的窗口状态
function getState() {
  let winState = localStorage.getItem('winState');
  winState = JSON.parse(winState);
  currentWindow.setBounds(winState.rect);
}

// 防抖函数
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

// 删除已经选择的etag
const handleTagClose = (tag) => {
  inputTags.value.splice(inputTags.value.indexOf(tag), 1)
  setTimeout(() => {
    adjustHeight()
  }, 50)
}

// 生成tag字符串,加入到输入框中，发送给braindoor
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

// 选择etag列表中的条目
function selectItem(item) {
  const textarea = inputRef.value.textarea
  const position = inputRef.value.textarea.selectionEnd
  // 如果inputTags.value中已经存在相同的条目，则不push进去
  const hasSameItem = inputTags.value.some(tag => {
    return tag.name === item.name && tag.type === item.type
  })
  if (!hasSameItem) {
    inputTags.value.push({ name: item.name, type: item.type, color: tagColor[item.type] })
  }
  
  setTimeout(() => {
    let text = textarea.value;
    const queryLength = tagQuery.length;
    textarea.value = text.substring(0, position - queryLength) + text.substring(position);
    inputText.value = textarea.value;
    textarea.selectionStart = position - queryLength;
    textarea.selectionEnd = position - queryLength;
    tagQuery = "/"
    adjustHeight()
  }, 50)
}

// 取消etag列表的显示
function cancel() {
  caretPosition = {
    display: "none"
  }
  showList.value = false;
  tagQuery = "/"
}

// 处理用户输入按键指令，包括调用etag接口，上下键选择，回车键确认
function onKeyDown(event) {
  const key = event.key;
  if (showList.value) {
    if ((key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight' || key === "Enter")) {
      event.preventDefault();
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
            selectItem(tagList.value[i]);
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
    } else if (/^[a-zA-Z]$/.test(key)) { // 输入字母模式
      tagQuery += key;
      // 根据tagQuery的值，从tabListCache中筛选出符合条件的tag,查询方法是从开头匹配字符串
      tagList.value = tagListCache.filter(item => {
        return item.abbr.startsWith(tagQuery)
      })
      if (tagList.value.length === 0) {
        cancel()
      }
    } else if (key === 'Backspace') {
      tagQuery = tagQuery.slice(0, -1);
      tagList.value = tagListCache.filter(item => {
        return item.abbr.startsWith(tagQuery)
      })
      if (tagQuery === "" || tagList.value.length === 0) {
        cancel()
      }
    }
  } else { // 输入文字模式
    if (key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendRequests()
    }
    if (key === '/') {
      tagList.value = tagListCache.filter(item => {
        return item.abbr.startsWith(tagQuery)
      })

      // 如果tagList不为空，且tagList中没有已经被选中的li, 则显示tagList，并且第一个li被选中
      let itemList = []
      if (tagList.value.length > 0) {
        itemList = listRef.value.querySelectorAll('li')
      }
      // 判断itemList如果不为空，且没有一个元素被选中，则选中第一个元素
      if (itemList.length > 0) {
        let flag = false
        for (let i = 0; i < itemList.length; i++) {
          if (itemList[i].classList.contains('selected')) {
            flag = true
            break
          }
        }
        if (!flag) {
          itemList[0].classList.add('selected')
        }
      }
      
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

// 页面加载时的各种初始化
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

////////////////////////////////////////////
<template>
  <el-row justify="center" align="bottom" class="QAs permeable" :style="{ height: bodyHeight }">
    <el-col :span="24" gutter="10" class="permeable">
      <el-scrollbar class="permeable" ref="scrollbarRef" :max-height="bodyHeight">
        <TransitionGroup tag="div" name="slide">
          <template>
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
        </template>
        </TransitionGroup>
      </el-scrollbar>
    </el-col>
  </el-row>
  <el-footer class="footer">
    <div id="magicInput">
      
      <div ref="listRef" class="popList" :style="caretPosition" v-show="showList">
        <ul>
          <li v-for="(item, index) in tagList" :key="index" @click="selectItem(item)" class="tag-item"
            style="display: table; width: 100%;">
            <el-text :type="item.color" style="display: table-row;">
              <span style="display: table-cell; text-align: left;">{{ item.name }}</span>
              <span style="display: table-cell; text-align: right;">{{ item.abbr }}</span>
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
          <el-input id="textArea" v-model="inputText" @input="handleInput" type="textarea" ref="inputRef"
            maxlength="2000" placeholder="请输入内容" resize="none" @focus="textAreaFocus" @blur="textAreaBlur"
            :autosize="{ minRows: 1, maxRows: 8 }" :disabled="streaming" @keydown="onKeyDown">
          </el-input>
        </el-row>
        <el-row class="toolbar">
          <div class="toolbar-inner" id="drag-handle">
            <el-col :span="16" @mouseover="toolbarOnHover" @mouseleave="toolbarOnLeave">
              <Transition name="fade">
                <el-button :icon="DocumentAdd" text circle @click="newPage" type="info" :disabled="streaming"
                  v-show="!streaming" />
              </Transition>
              <el-popconfirm title="确定删除页面?" hide-after=0 confirm-button-type="danger" position="top" @confirm="delPage"
                placement="top">
                <template #reference>
                  <Transition name="fade">
                    <el-button :icon="Delete" text circle type="info" :disabled="streaming" v-show="!streaming" />
                  </Transition>
                </template>
              </el-popconfirm>
              <Transition name="fade">
                <el-button :icon="Lock" text circle @click="lock" type="info" :disabled="streaming" v-show="!streaming" />
              </Transition>
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

////////////////////////////////////////////

<style src="./style.css"></style>
