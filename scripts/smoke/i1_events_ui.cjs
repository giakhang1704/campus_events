const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

module.exports = async function verifyOrganizerEvents(page, base, root) {
  const title = 'Workshop UI ' + crypto.randomBytes(5).toString('hex');
  // Each date-time field is a date input plus a time input: "2030-11-10T08:00" fills both.
  const fillAt = async (p, label, value) => {
    await p.getByLabel(label + ' – ngày', {exact:true}).fill(value.slice(0, 10));
    // Time is three selects: hour 01–12, minute in 5-minute steps, AM/PM.
    const h = Number(value.slice(11, 13));
    await p.getByLabel(label + ' – giờ', {exact:true}).selectOption(String(h % 12 || 12).padStart(2, '0'));
    await p.getByLabel(label + ' – phút', {exact:true}).selectOption(value.slice(14, 16));
    await p.getByLabel(label + ' – buổi', {exact:true}).selectOption(h < 12 ? 'AM' : 'PM');
  };
  await page.getByRole('heading', {name:'Sự kiện quản lý', exact:true}).waitFor();
  await page.getByText('Chưa có sự kiện nào', {exact:true}).waitFor();
  await page.getByRole('button', {name:'Tạo sự kiện', exact:true}).click();
  await page.getByRole('button', {name:'Hủy', exact:true}).click();
  await page.getByText('Chưa có sự kiện nào', {exact:true}).waitFor();
  await page.getByRole('button', {name:'Tạo sự kiện', exact:true}).click();
  await page.getByRole('button', {name:'Lưu nháp', exact:true}).click();
  await page.locator('#event-title-error').waitFor();
  await page.getByLabel('Tên sự kiện', {exact:true}).fill(title);
  await page.getByLabel('Mô tả', {exact:true}).fill('Mô tả workshop kiểm thử giao diện.');
  await page.getByLabel('Địa điểm', {exact:true}).fill('Phòng A');
  await page.getByLabel('Đơn vị tổ chức', {exact:true}).selectOption({index:1});
  await fillAt(page, 'Mở đăng ký', '2030-11-10T08:00');
  await fillAt(page, 'Đóng đăng ký', '2030-11-10T07:00');
  await fillAt(page, 'Bắt đầu sự kiện', '2030-11-11T08:00');
  await fillAt(page, 'Kết thúc sự kiện', '2030-11-11T10:00');
  await page.getByLabel('Sức chứa', {exact:true}).fill('20');
  await page.getByLabel('Năm 1', {exact:true}).check();
  await page.getByLabel('Năm 2', {exact:true}).check();
  const departments = page.getByRole('group', {name:'Danh sách khoa'}).getByRole('checkbox');
  await departments.nth(1).check();
  await departments.nth(2).check();
  assert.equal(await page.getByLabel('Tất cả các khoa', {exact:true}).isChecked(), false);
  await page.getByRole('button', {name:'Lưu nháp', exact:true}).click();
  await page.locator('#event-close-error').waitFor();
  await fillAt(page, 'Đóng đăng ký', '2030-11-11T08:00');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(root,'frontend/.angular/i1-event-editor-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button', {name:'Lưu nháp', exact:true}).click();
  const row = page.getByRole('row').filter({hasText:title});
  await row.getByText('Bản nháp', {exact:true}).waitFor();
  await page.reload();
  await row.getByText('Bản nháp', {exact:true}).waitFor();

  const otherTab = await page.context().newPage();
  try {
    await otherTab.goto(base);
    const otherRow = otherTab.getByRole('row').filter({hasText:title});
    await otherRow.getByRole('button', {name:'Chỉnh sửa',exact:true}).click();
    await otherTab.getByLabel('Địa điểm', {exact:true}).waitFor();
    await row.getByRole('button', {name:'Chỉnh sửa',exact:true}).click();
    await page.getByLabel('Địa điểm', {exact:true}).fill('Phòng B');
    await page.getByRole('button', {name:'Lưu thay đổi',exact:true}).click();
    await row.getByText(/Phòng B/).waitFor();
    await otherTab.getByLabel('Mô tả', {exact:true}).fill('Nội dung chưa lưu trên tab B');
    await otherTab.getByRole('button', {name:'Lưu thay đổi',exact:true}).click();
    await otherTab.getByRole('button', {name:'Tải bản mới',exact:true}).waitFor();
    assert.equal(await otherTab.getByLabel('Mô tả', {exact:true}).inputValue(),'Nội dung chưa lưu trên tab B');
    await otherTab.getByRole('button', {name:'Tải bản mới',exact:true}).click();
    await otherTab.waitForFunction(()=>document.querySelector('input[name="location"]').value==='Phòng B');
    assert.equal(await otherTab.getByLabel('Mô tả', {exact:true}).inputValue(),'Mô tả workshop kiểm thử giao diện.');
    await otherTab.getByRole('button', {name:'Hủy',exact:true}).click();
  } finally { await otherTab.close(); }

  await row.getByRole('button', {name:'Công bố',exact:true}).click();
  await page.getByRole('heading', {name:'Xác nhận công bố sự kiện',exact:true}).waitFor();
  await page.getByRole('button', {name:'Hủy công bố',exact:true}).click();
  await row.getByText('Bản nháp', {exact:true}).waitFor();
  await row.getByRole('button', {name:'Công bố',exact:true}).click();
  await page.screenshot({path:path.join(root,'frontend/.angular/i1-event-publish.png'),fullPage:true});
  await page.getByRole('button', {name:'Xác nhận công bố',exact:true}).click();
  await row.getByText('Đã công bố', {exact:true}).waitFor();
  assert.equal(await row.getByRole('button', {name:'Công bố',exact:true}).count(),0);
  await page.reload();
  await row.getByText('Đã công bố', {exact:true}).waitFor();
  console.log('PASS: browser event draft/create/cancel, validation, edit, two-tab version conflict, reload, publish confirmation/cancel and mobile layout.');
};
