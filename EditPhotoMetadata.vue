<template>
  <div>
    <label v-for="(value, key) in metadata" :key="key">
      {{ key }}:
      <input
        v-if="key.includes('time')"
        type="datetime-local"
        :value="convertISOToLocal(value)"
        @input="updateMetadata(key, convertLocalToISO($event.target.value))"
      />
      <input
        v-else
        v-model="value"
        @input="updateMetadata(key, value)"
      />
    </label>
  </div>
</template>

<script>
export default {
  props: {
    metadata: Object,
  },
  methods: {
    convertISOToLocal(isoString) {
      if (!isoString) return '';
      const date = new Date(isoString);
      return date.toISOString().slice(0, 16);
    },
    convertLocalToISO(localString) {
      return new Date(localString).toISOString();
    },
    updateMetadata(key, value) {
      this.$emit('update-metadata', { key, value });
    },
  },
};
</script>
