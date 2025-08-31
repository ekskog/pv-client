<template>
  <div class="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-lg">
      <h2 class="text-lg font-semibold mb-4">Edit Photo Metadata</h2>

      <form @submit.prevent="saveMetadata">
        <div v-for="(value, key) in editableMetadata" :key="key" class="mb-6">
          <!-- Skip location field as it's calculated from coordinates -->
          <div v-if="key === 'location'" class="border-l pl-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ key }}</label>
            <div class="text-sm text-gray-500 italic">
              {{ value }} (calculated from coordinates)
            </div>
          </div>
          
          <!-- Special handling for coordinates - split into lat/lng -->
          <div v-else-if="key === 'coordinates'" class="border-l pl-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Coordinates</label>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label for="latitude" class="block text-xs text-gray-600 mb-1">Latitude</label>
                <input 
                  type="number" 
                  step="any"
                  id="latitude" 
                  v-model="latitude" 
                  class="block w-full border border-black rounded-md px-2 py-1 text-sm"
                  placeholder="e.g., 59.3293"
                />
              </div>
              <div>
                <label for="longitude" class="block text-xs text-gray-600 mb-1">Longitude</label>
                <input 
                  type="number" 
                  step="any"
                  id="longitude" 
                  v-model="longitude" 
                  class="block w-full border border-black rounded-md px-2 py-1 text-sm"
                  placeholder="e.g., 18.0686"
                />
              </div>
            </div>
          </div>

          <!-- Handle strings and numbers -->
          <div v-else-if="typeof value === 'string' || typeof value === 'number'" class="border-l pl-4">
            <label :for="key" class="block text-sm font-medium text-gray-700 mb-1">{{ key }}</label>
            <input 
              type="text" 
              :id="key" 
              v-model="editableMetadata[key]" 
              class="block w-full border border-black rounded-md px-2 py-1 text-sm"
            />
          </div>

          <!-- Handle nested objects -->
          <div v-else-if="typeof value === 'object' && !Array.isArray(value)" class="border-l pl-4">
            <div class="flex justify-between items-center cursor-pointer mb-2" @click="toggleExpand(key)">
              <h3 class="text-sm font-medium text-gray-900">{{ key }}</h3>
              <span class="text-gray-700 text-sm">{{ expanded[key] ? '−' : '+' }}</span>
            </div>
            <div v-if="expanded[key]" class="mt-2">
              <div v-for="(nestedValue, nestedKey) in value" :key="nestedKey" class="mb-4">
                <label :for="nestedKey" class="block text-sm font-medium text-gray-700 mb-1">{{ nestedKey }}</label>
                <input 
                  v-if="typeof nestedValue === 'string' || typeof nestedValue === 'number'" 
                  type="text" 
                  v-model="editableMetadata[key][nestedKey]" 
                  class="block w-full border border-black rounded-md px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>

          <!-- Handle arrays -->
          <div v-else-if="Array.isArray(value)" class="border-l pl-4 space-y-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ key }}</label>
            <div v-for="(item, index) in value" :key="index" class="flex items-center gap-2">
              <input 
                type="text" 
                v-model="editableMetadata[key][index]" 
                class="block w-full border border-black rounded-md px-2 py-1 text-sm"
              />
              <button 
                type="button" 
                @click="removeArrayItem(key, index)" 
                class="text-red-500 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>
            <button 
              type="button" 
              @click="addArrayItem(key)" 
              class="text-blue-500 hover:text-blue-700 text-sm mt-2"
            >
              Add Item
            </button>
          </div>
        </div>

        <div class="flex justify-end gap-4 border-t pt-4 mt-6">
          <button 
            type="button" 
            @click="$emit('close')" 
            class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    metadata: Object
  },
  data() {
    return {
      editableMetadata: JSON.parse(JSON.stringify(this.metadata || {})),
      expanded: {}
    };
  },
  methods: {
    toggleExpand(key) {
      this.$set(this.expanded, key, !this.expanded[key]);
    },
    addArrayItem(key) {
      this.editableMetadata[key].push('');
    },
    removeArrayItem(key, index) {
      this.editableMetadata[key].splice(index, 1);
    },
    saveMetadata() {
      this.$emit('save', this.editableMetadata);
    }
  }
};
</script>



<script setup>
import { reactive, toRefs, ref } from 'vue';
import apiService from '../services/api.js';

const props = defineProps({
  photo: { type: Object, required: true },
  photoMetadataLookup: { type: Object, required: true }
});

const emit = defineEmits(['save', 'close']);

const editableMetadata = reactive({ ...props.photoMetadataLookup[props.photo.name] });
const expanded = reactive({});

// Parse coordinates into separate lat/lng fields
const parseCoordinates = (coordString) => {
  if (!coordString || coordString === 'not found') return { lat: '', lng: '' };
  const parts = coordString.split(',');
  return {
    lat: parts[0]?.trim() || '',
    lng: parts[1]?.trim() || ''
  };
};

const initialCoords = parseCoordinates(editableMetadata.coordinates);
const latitude = ref(initialCoords.lat);
const longitude = ref(initialCoords.lng);

const saveMetadata = async () => {
  try {
    // Combine latitude and longitude back into coordinates string
    if (latitude.value && longitude.value) {
      editableMetadata.coordinates = `${latitude.value},${longitude.value}`;
    } else if (!latitude.value && !longitude.value) {
      editableMetadata.coordinates = 'not found';
    } else {
      // If only one is provided, keep the original or set to 'not found'
      editableMetadata.coordinates = editableMetadata.coordinates || 'not found';
    }
    
    console.log('Saving metadata:', editableMetadata);
    
    // Get the complete path from the metadata sourceImage field
    const currentMetadata = props.photoMetadataLookup[props.photo.name];
    const sourceImage = currentMetadata?.sourceImage || props.photo.name;
    console.log('Source image path:', sourceImage);
    
    // Extract folder path and object name from sourceImage
    const pathParts = sourceImage.split('/');
    const objectName = pathParts.pop(); // Get the filename
    const folderPath = pathParts.join('/'); // Get the folder path
    
    console.log('Extracted folderPath:', folderPath, 'objectName:', objectName);
    
    // Send the updated metadata to the backend using API service
    console.log('Making request to update metadata for:', folderPath, objectName);
    
    const result = await apiService.updatePhotoMetadata(folderPath, objectName, editableMetadata);
    console.log('Metadata update result:', result);

    // Update the local metadata lookup
    props.photoMetadataLookup[props.photo.name] = { ...editableMetadata };
    
    // Emit success event
    emit('save', editableMetadata);
    emit('close');
    
  } catch (error) {
    console.error('Error saving metadata:', error);
    alert(`Failed to save metadata: ${error.message}`);
  }
};

const addArrayItem = (key) => {
  editableMetadata[key].push('');
};

const removeArrayItem = (key, index) => {
  editableMetadata[key].splice(index, 1);
};

const toggleExpand = (key) => {
  expanded[key] = !expanded[key];
};
</script>

<style scoped>
/* Add any necessary styles here */
</style>
