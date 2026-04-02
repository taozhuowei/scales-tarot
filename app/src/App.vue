<script setup lang="ts">
import { onLaunch, onShow } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("App Launch");
});

onShow(() => {
  console.log("App Show");
});
</script>

<style>
@import "./styles/global.css";
</style>
