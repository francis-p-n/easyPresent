/**
 * CampTemplates — predefined slide template sets for camp use.
 * Each set generates a ready-to-use Presentation with slides.
 */

export const CAMP_TEMPLATE_SETS = [
  {
    id: 'worship-set',
    name: 'Worship Set',
    icon: 'music',
    description: 'Blank worship slides with lyric structure',
    type: 'worship',
    slides: [
      { label: 'Verse 1', group: 'verse', type: 'worship', templateId: 'worship', text: 'Verse 1 lyrics here\nLine two\nLine three' },
      { label: 'Chorus', group: 'chorus', type: 'worship', templateId: 'worship', text: 'Chorus lyrics here\nLine two' },
      { label: 'Verse 2', group: 'verse', type: 'worship', templateId: 'worship', text: 'Verse 2 lyrics here\nLine two\nLine three' },
      { label: 'Chorus', group: 'chorus', type: 'worship', templateId: 'worship', text: 'Chorus lyrics here\nLine two' },
      { label: 'Bridge', group: 'bridge', type: 'worship', templateId: 'worship', text: 'Bridge text here' },
      { label: 'Blank', group: 'blank', type: 'blank', templateId: 'blank', text: '' },
    ]
  },
  {
    id: 'announcements',
    name: 'Camp Announcements',
    icon: 'megaphone',
    description: 'Quick-editable announcement slides (double-click to edit)',
    type: 'announcement',
    slides: [
      { label: 'Announcement 1', group: 'intro', type: 'announcement', templateId: 'announcement', text: 'ANNOUNCEMENT TITLE\n\nDetails go here\nTime: 7:00 PM\nLocation: Main Hall', announcementData: { headline: 'ANNOUNCEMENT TITLE', body: 'Details go here', time: '7:00 PM', location: 'Main Hall' } },
      { label: 'Announcement 2', group: 'intro', type: 'announcement', templateId: 'announcement', text: 'ANNOUNCEMENT TITLE\n\nDetails go here\nTime: 7:00 PM\nLocation: Main Hall', announcementData: { headline: 'ANNOUNCEMENT TITLE', body: 'Details go here', time: '7:00 PM', location: 'Main Hall' } },
      { label: 'Announcement 3', group: 'intro', type: 'announcement', templateId: 'announcement', text: 'ANNOUNCEMENT TITLE\n\nDetails go here\nTime: 7:00 PM\nLocation: Main Hall', announcementData: { headline: 'ANNOUNCEMENT TITLE', body: 'Details go here', time: '7:00 PM', location: 'Main Hall' } },
    ]
  },
  {
    id: 'game-show',
    name: 'Camp Games',
    icon: 'gamepad-2',
    description: 'Score tracker, trivia, and countdown slides',
    type: 'game',
    slides: [
      { label: 'Game Title', group: 'intro', type: 'game', templateId: 'game', text: 'GAME NAME' },
      { label: 'Question 1', group: 'verse', type: 'game', templateId: 'game', text: 'Question here?' },
      { label: 'Answer 1', group: 'chorus', type: 'game', templateId: 'game', text: 'Answer here!' },
      { label: 'Scores', group: 'tag', type: 'game', templateId: 'game', text: 'Team A: 0\nTeam B: 0' },
      { label: 'Winner', group: 'outro', type: 'game', templateId: 'game', text: 'WINNER\nTeam Name' },
    ]
  },
  {
    id: 'scripture',
    name: 'Scripture',
    icon: 'book-open',
    description: 'Scripture verses with reference',
    type: 'scripture',
    slides: [
      { label: 'Verse', group: 'verse', type: 'scripture', templateId: 'scripture', text: '"Scripture text here."\n\n— Reference 1:1' },
      { label: 'Verse', group: 'verse', type: 'scripture', templateId: 'scripture', text: '"Scripture text here."\n\n— Reference 1:1' },
    ]
  },
  {
    id: 'camp-theme',
    name: 'Camp Theme',
    icon: 'tent',
    description: 'Camp theme, schedule, and announcement slides',
    type: 'camp',
    slides: [
      { label: 'Welcome', group: 'intro', type: 'camp', templateId: 'camp', text: 'WELCOME TO\nCAMP NAME 2025' },
      { label: 'Theme', group: 'verse', type: 'camp', templateId: 'camp', text: 'THEME:\n"Theme Title Here"' },
      { label: 'Schedule', group: 'verse', type: 'camp', templateId: 'camp', text: "TODAY'S SCHEDULE\n9:00 AM  Breakfast\n10:00 AM Worship\n12:00 PM Lunch\n2:00 PM  Activity\n7:00 PM  Evening Service" },
      { label: 'Blank', group: 'blank', type: 'blank', templateId: 'blank', text: '' },
    ]
  },
]
