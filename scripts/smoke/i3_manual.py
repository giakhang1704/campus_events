"""Manual API demonstration on a dedicated Docker project; never writes to localhost dev DB."""
import argparse
from datetime import datetime,timedelta,timezone
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
os.environ['I1_API_BASE']='http://127.0.0.1:18083/api'
os.environ['I1_TEST_PROJECT']='campus-events-i3-demo'
os.environ['I1_TEST_COMPOSE']='compose.i3-test.yaml'
from i1_http import BASE, Client, PASSWORD, ready

ROOT=Path(__file__).resolve().parents[2]
OUTPUT=ROOT/'backend/target/i3-demo'
STATE=OUTPUT/'state.json'
EMAIL={'registered':'student.i1@example.test','waiting':'waiting.i3-demo@example.test'}


class DemoFailure(Exception):pass


def api(client,method,path,body=None):
    result=client.call(method,path,body,expected=(200,201,204,400,401,403,404,409,413,500,503))
    if isinstance(result,dict) and 'code' in result and 'message' in result:
        raise DemoFailure(result['code']+': '+result['message'])
    return result


def login(email):
    client=Client()
    api(client,'POST','/auth/login',dict(email=email,password=PASSWORD))
    return client


def save(state):
    STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')


def download(client,path,target):
    try:
        with client.opener.open(urllib.request.Request(BASE+path),timeout=20) as response:
            target.write_bytes(response.read())
    except urllib.error.HTTPError as error:
        result=json.loads(error.read().decode('utf-8'))
        raise DemoFailure(result.get('code','HTTP_'+str(error.code))+': '+result.get('message','Download failed'))


def local_time(value):
    return datetime.fromisoformat(value).astimezone(timezone(timedelta(hours=7))).strftime('%d/%m/%Y %H:%M:%S +07:00')


def start(minutes):
    ready()
    organizer=login('organizer.i1@example.test')
    student=login(EMAIL['registered'])
    state=json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else {}
    event=None
    if state.get('eventId'):
        result=organizer.call('GET',f"/organizer/events/{state['eventId']}",expected=(200,404))
        if result.get('title')=='I3 - demo điểm danh thủ công' and datetime.fromisoformat(result['endsAt'])>datetime.now(timezone.utc):event=result
    if event is None:
        now=datetime.now(timezone(timedelta(hours=7)))
        unit=api(organizer,'GET','/catalog/organization-units')[0]['id']
        content=dict(title='I3 - demo điểm danh thủ công',description='Private manual API demo',location='Phòng demo I3',organizationUnitId=unit,
            registrationOpensAt=(now-timedelta(days=1)).isoformat(),registrationClosesAt=(now+timedelta(minutes=5)).isoformat(),
            startsAt=(now+timedelta(minutes=10)).isoformat(),endsAt=(now+timedelta(hours=2)).isoformat(),capacity=1,departmentIds=[],studyYears=[])
        event=api(organizer,'POST','/events',content)
        event=api(organizer,'POST',f"/events/{event['id']}/publish",dict(version=event['version']))
        state={'eventId':event['id']}
        api(student,'POST',f"/events/{event['id']}/registrations",{})
        department=api(student,'GET','/catalog/departments')[0]['id']
        client=Client()
        registered=client.call('POST','/auth/register',dict(fullName='Sinh viên danh sách chờ I3',email=EMAIL['waiting'],password=PASSWORD,
            studentCode='I3DEMOWAITING',departmentId=department,studyYear=2),expected=(201,409))
        if registered.get('code') not in (None,'EMAIL_EXISTS'):raise DemoFailure('Không tạo được tài khoản thử danh sách chờ.')
        waiting=login(EMAIL['waiting'])
        api(waiting,'POST',f"/events/{event['id']}/registrations",{})
    refresh(state,organizer,minutes)
    print('Đã tạo môi trường demo riêng, API http://localhost:18083/api.')
    print('Sinh viên chính thức:',EMAIL['registered'],'; sinh viên chờ:',EMAIL['waiting'])
    print('Demo gọi API thật; chưa sử dụng camera. Mật khẩu/khóa chỉ nằm trong thư mục target bị Git ignore.')
    print('Tiếp theo: ./scripts/demo-i3.ps1 -Action Preview, rồi -Action Confirm.')


def refresh(state,organizer,minutes):
    event_id=state['eventId']
    session=api(organizer,'POST',f'/organizer/events/{event_id}/attendance/sessions',dict(durationMinutes=minutes))
    state['session']=session
    state.pop('preview',None)
    download(organizer,f"/organizer/events/{event_id}/attendance/sessions/{session['id']}/qr.svg",OUTPUT/'qr.svg')
    save(state)
    print('Event:',event_id,'; phiên QR:',session['id'],'; hết hạn:',local_time(session['expiresAt']))
    print('Mở file QR:',OUTPUT/'qr.svg')


def main():
    parser=argparse.ArgumentParser()
    actions={name.lower():name for name in ['Start','Preview','Confirm','Report','Export','Close','Refresh','ManualPresent','ManualClear','History']}
    parser.add_argument('--action',required=True,type=lambda value:actions.get(value.lower(),value),choices=actions.values())
    parser.add_argument('--student',type=str.lower,choices=['registered','waiting'],default='registered')
    parser.add_argument('--reason',default='')
    parser.add_argument('--duration-minutes',type=int,default=10)
    args=parser.parse_args()
    if args.action=='Start':start(args.duration_minutes);return
    if not STATE.exists():raise DemoFailure('Chạy -Action Start trước.')
    state=json.loads(STATE.read_text(encoding='utf-8'));event_id=state['eventId']
    if args.action in ('Preview','Confirm'):
        student=login(EMAIL[args.student]);payload=json.loads(state['session']['qrPayload'])
        body=dict(sessionId=payload['sessionId'],token=payload['token'])
        if args.action=='Preview':
            preview=api(student,'POST',f'/events/{event_id}/attendance/preview',body)
            state['preview']={'student':args.student,'data':preview};save(state)
            print('Xem trước (chưa ghi thêm điểm danh):',preview['title'])
            print('Địa điểm:',preview['location'],'; bắt đầu:',local_time(preview['startsAt']))
            print('Đã có PRESENT:',preview['alreadyPresent'],'; phiên hết hạn:',local_time(preview['expiresAt']))
            print('Muốn ghi nhận, chạy: ./scripts/demo-i3.ps1 -Action Confirm')
        else:
            preview=state.get('preview')
            if not preview or preview['student']!=args.student:raise DemoFailure('Chạy -Action Preview cho đúng sinh viên trước khi xác nhận.')
            body.update(eventVersion=preview['data']['eventVersion'],registrationVersion=preview['data']['registrationVersion'],attendanceVersion=preview['data']['attendanceVersion'])
            result=api(student,'POST',f'/events/{event_id}/attendance/check-in',body)
            print('Xác nhận thành công:',result['result'],'; method:',result['method'],'; lúc:',local_time(result['recordedAt']))
            print('Xem số liệu: ./scripts/demo-i3.ps1 -Action Report')
        return
    organizer=login('organizer.i1@example.test')
    if args.action=='Refresh':refresh(state,organizer,args.duration_minutes)
    elif args.action=='Close':
        result=api(organizer,'POST',f"/organizer/events/{event_id}/attendance/sessions/{state['session']['id']}/close",{})
        print('Đã đóng phiên:',result['id'],'; active:',result['active'])
    elif args.action=='Report':
        result=api(organizer,'GET',f'/organizer/events/{event_id}/report')
        for field in ('generatedAt','endsAt'):
            result[field]=datetime.fromisoformat(result[field]).astimezone(timezone(timedelta(hours=7))).isoformat()
        print(json.dumps(result,ensure_ascii=False,indent=2))
    elif args.action=='Export':
        download(organizer,f'/organizer/events/{event_id}/report.csv',OUTPUT/'report.csv')
        print('Đã xuất CSV:',OUTPUT/'report.csv')
    elif args.action in ('ManualPresent','ManualClear','History'):
        selected=login(EMAIL[args.student])
        registration=api(selected,'GET',f'/events/{event_id}/registration')['registration']
        if not registration:raise DemoFailure('Sinh viên chưa có đăng ký trong sự kiện mẫu.')
        if args.action=='History':
            result=api(organizer,'GET',f"/organizer/events/{event_id}/attendance/{registration['id']}/history")
            print(json.dumps(result,ensure_ascii=False,indent=2))
        else:
            if not args.reason.strip():raise DemoFailure('Cần -Reason khi chỉnh sửa thủ công.')
            recorded=api(selected,'GET',f'/events/{event_id}/attendance')['attendance']
            request=dict(result='PRESENT' if args.action=='ManualPresent' else 'NOT_RECORDED',
                version=recorded['version'] if recorded else 0,registrationVersion=registration['version'],reason=args.reason)
            result=api(organizer,'PUT',f"/organizer/events/{event_id}/attendance/{registration['id']}",request)
            print('Kết quả hiện hành:',result['result'],'; method:',result['method'],'; version:',result['version'])


if __name__=='__main__':
    try:main()
    except (DemoFailure,AssertionError,OSError,json.JSONDecodeError) as error:
        print('Không thực hiện được:',str(error),file=sys.stderr)
        sys.exit(1)
