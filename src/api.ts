export const apiBase = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? new URL(import.meta.env.BASE_URL, window.location.origin).href : '')).trim().replace(/\/$/, '');
export const apiConfigured = Boolean(apiBase);
const tokenKey = 'g-super-league:admin-token';
export function adminToken(){return sessionStorage.getItem(tokenKey)||''}
export function clearAdmin(){sessionStorage.removeItem(tokenKey)}
export function photoUrl(path:string){return path.startsWith('/api/photos/')?`${apiBase}${path}`:''}
export async function apiFetch(path:string,init:RequestInit={}){
 if(!apiConfigured)throw new Error('网站尚未连接数据服务，请先完成部署配置。');
 const headers=new Headers(init.headers);
 if(init.method && init.method!=='GET'){
  const token=adminToken();
  if(!token)throw new Error('请先点击右上角「管理员登录」，再保存修改。');
  headers.set('Authorization',`Bearer ${token}`);
 }
 return fetch(`${apiBase}${path}`,{...init,headers,mode:'cors',credentials:'omit'});
}
export async function loginAdmin(token:string){
 const r=await fetch(`${apiBase}/api/auth`,{method:'POST',headers:{Authorization:`Bearer ${token}`},mode:'cors',credentials:'omit'});
 if(!r.ok)throw new Error('管理密钥不正确或数据服务不可用');
 sessionStorage.setItem(tokenKey,token);
}

const singlesTokenKey = 'g-super-league:singles-admin-token';
export const singlesToken = () => sessionStorage.getItem(singlesTokenKey) || '';
export const clearSinglesAdmin = () => sessionStorage.removeItem(singlesTokenKey);
export const singlesPhotoUrl = (path: string) => /^\/api\/singles\/photos\/[a-f0-9-]+$/.test(path) ? `${apiBase}${path}` : '';
export async function singlesRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiConfigured) throw new Error('网站尚未连接数据服务');
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET' && !headers.has('Authorization')) {
    const token = singlesToken();
    if (!token) throw new Error('请先登录单打管理');
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${apiBase}/api/singles${path}`, { ...init, headers, mode: 'cors', credentials: 'omit' });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || (response.status === 404 ? '单打服务尚未部署' : '单打服务暂时不可用'));
  }
  return response.json() as Promise<T>;
}
export async function loginSinglesAdmin(token: string) {
  await singlesRequest('/auth', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  sessionStorage.setItem(singlesTokenKey, token);
}
