import { gptServerStore, homeStore, useAuthStore } from "@/store";
import { mlog } from "./mjapi";
import { pixverseRep, pixverseStore, pixverseTask } from "./pixverseStore";
import { sleep } from "./suno";
// import { KlingTask, klingStore } from "./klingStore";
// import { sleep } from "./suno";



function getHeaderAuthorization(){
    let headers={}
    if( homeStore.myData.vtoken ){
        const  vtokenh={ 'x-vtoken':  homeStore.myData.vtoken ,'x-ctoken':  homeStore.myData.ctoken};
        headers= {...headers, ...vtokenh}
    }
    if(!gptServerStore.myData.KLING_KEY){ 
        const authStore = useAuthStore()
        if( authStore.token ) {
            const bmi= { 'x-ptoken':  authStore.token };
            headers= {...headers, ...bmi }
            return headers;
        }
        return headers
    }
    const bmi={
        'Authorization': 'Bearer ' +gptServerStore.myData.PIXVERSE_KEY
    }
    headers= {...headers, ...bmi }
    return headers
}

export const  getUrl=(url:string)=>{
    if(url.indexOf('http')==0) return url;
    
    const pro_prefix= '';//homeStore.myData.is_luma_pro?'/pro':''
    url= url.replaceAll('/pro','')
    if(gptServerStore.myData.PIXVERSE_SERVER  ){
      
        return `${ gptServerStore.myData.PIXVERSE_SERVER}${pro_prefix}/pixverse${url}`;
    }
    return `${pro_prefix}/pixverse${url}`;
}


export const pixFetch=(url:string,data?:any,opt2?:any )=>{
    mlog('runwayFetch', url  );
    let headers= opt2?.upFile?{}: {'Content-Type':'application/json'}
     
    if(opt2 && opt2.headers ) headers= opt2.headers;

    headers={...headers,...getHeaderAuthorization()}
   
    return new Promise<any>((resolve, reject) => {
        let opt:RequestInit ={method:'GET'};
       
        opt.headers= headers ;
        if(opt2?.upFile ){
             opt.method='POST';
             opt.body=data as FormData ;
        }
        else if(data) {
            opt.body= JSON.stringify(data) ;
            opt.method='POST';
        }
        fetch(getUrl(url),  opt )
        .then( async (d) =>{
            if (!d.ok) { 
                let msg = '发生错误: '+ d.status
                try{ 
                  let bjson:any  = await d.json();
                  msg = '('+ d.status+')发生错误: '+(bjson?.error?.message??'' ) 
                }catch( e ){ 
                }
                homeStore.myData.ms &&  homeStore.myData.ms.error(msg )
                throw new Error( msg );
            }
     
            d.json().then(d=> resolve(d)).catch(e=>{ 
            
                homeStore.myData.ms &&  homeStore.myData.ms.error('发生错误'+ e )
                reject(e) 
            }
        )})
        .catch(e=>{ 
            if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
                homeStore.myData.ms &&  homeStore.myData.ms.error('跨域|CORS error'  )
            }
            else homeStore.myData.ms &&  homeStore.myData.ms.error('发生错误:'+e )
            mlog('e', e.stat )
            reject(e)
        })
    })

}

export const pixFeed= async( id:number)=>{
    const sunoS = new pixverseStore();
    let url= `/feed/${id}`;
    for(let i=0; i<200;i++){
         try{
            
            let a= await pixFetch( url )
            //let task= a  as KlingTask;
            if(a.ErrCode==0 && a.Resp){
            //task.last_feed=new Date().getTime()
                let d= a.Resp as pixverseRep
                const task:pixverseTask={ video_id:id,last_feed:new Date().getTime(), data:d } 
                sunoS.save( task )
                homeStore.setMyData({act:'PixFeed'});
                mlog('pixFetch', a )
                if (d.video_status==1){
                    break;
                }
                
            }
         }catch(e){
         }
        await sleep(5200)
    }


}
