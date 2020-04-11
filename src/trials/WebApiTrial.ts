import axios from 'axios';
const url = "https://jsonplaceholder.typicode.com/posts/1";
export async function axiosGetTrial() : Promise<void>{
  try {
    let res = await axios.get(url);
    console.log(res.data);
  } catch(e) {
    console.log(e);
  }
}

