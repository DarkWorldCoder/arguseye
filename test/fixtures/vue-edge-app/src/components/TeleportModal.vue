<template>
  <span>Trigger</span>
  <Teleport to="body"><div role="dialog" aria-label="Teleported dialog" class="modal">Dialog in body</div></Teleport>
</template>
<style scoped>.modal { position: fixed; inset: 40px; background: white; border: 1px solid #ccc; }</style>
