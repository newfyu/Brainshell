<template>
  <div id="StreamAnswer">

    <!-- 一个容器，高600，宽400，容器中的内容全部靠底部对齐 -->
 
    <el-row justify="center" align="bottom" class="QAs">
     
      <el-col :span="10" gutter="10">
        <el-scrollbar ref="scrollbarRef" height="400px">
        <div class="grid-content ep-bg-purple-dark QA" v-for="(once, index) in info" :key="index">
            <div><div class="Q">{{ once[0] }}</div></div>
            <div><div class="A">{{ once[1] }}</div></div>
        </div>
      </el-scrollbar>
      </el-col>
   
    </el-row>


    <el-button type="primary" @click="sendRequests">发送stream请求</el-button>
    <el-button type="primary" @click="scrollTest">scrollEnd</el-button>
    
  </div>
</template>

<script>
import axios from 'axios';
export default {
  name: 'StreamAnswer',
  data() {
    return {
      info:[["你好", "xxx"], ["你好2", "故人西辞黄鹤楼"], ["你好3", "“HTML和CSS颜色规范中定义了147种颜色名,其中17种标准色是: Aqua浅绿色、 Black黑色、 Blue蓝色、 Fuchsia紫红色、 Gray灰色、 Green绿色、 Lime绿黄色 Maroon褐红色、 Navy海军蓝、 Olive黄褐色、 Orange橙色、 Purple紫色、 Red红色、 Silver银灰色 Teal蓝绿色、 White白色、 Yellow黄色”"]]
    }
  },
  methods: {
    sendRequests() {
    // 发送主请求
    console.log('test')
    axios.post('http://127.0.0.1:7860/run/ask', {
      data: ["你好", "", "default", ""]
    }).then(response => {
      this.info = response['data']['data'][0]
      clearInterval(intervalId); // 停止发送请求B
    }).catch(error => {
      console.error(error);      // 请求A回复失败
    });

    // 发送临时结果请求
    const intervalId = setInterval(() => {
      axios.post('http://127.0.0.1:7860/run/get_ask_stream_answer', {
        data: ["", []]
      }).then(response => {
        this.info = response['data']['data'][0] // 数组，包含了所有历史记录
      }).catch(error => {
        console.error(error);
      });
    }, 100);
  },

  scrollTest() { 
    this.$refs.scrollbarRef.setScrollTop(9999) //滚动到底部
  }


  },
}
</script>

<style>
.grid-content {
  border-radius: 4px;
  min-height: 36px;
  /* background-color: bisque; */
  margin:10px;
}
.Q {
  /* display: inline-block; */
  text-align: left;
  vertical-align: middle;
  background-color: gray;
  padding: 20px;
  color:white;
}
.A {
  /* display: inline-block; */
  text-align: left;
  vertical-align: middle;
  background-color: CornflowerBlue ;
  color:white;
  margin-top: 20px;
  padding: 20px;
}

.QA {
  text-align: right;
}

</style>